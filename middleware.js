import { NextResponse } from 'next/server';
import { COOKIE, firmarSesion, hayQueRenovar, leerSesion, opcionesCookie } from './lib/sesion';

// El portero. Corre en Edge, así que **no puede leer la base de datos**: acá solo se comprueba
// que haya sesión, se renueva la cookie y se ponen las cabeceras de seguridad. El rol lo
// deciden las páginas y los route handlers, que corren en Node — y que de todos modos son los
// que tienen que decidirlo, porque son los que entregan los datos.

/** Rutas a las que se entra sin sesión. Pasan igual por acá: también quieren sus cabeceras. */
const PUBLICAS = new Set(['/login', '/api/login']);

const ESCRIBEN = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * ¿La petición viene de otro sitio?
 *
 * La cookie es `sameSite: 'lax'`, así que el navegador ya no la manda en un POST que salga de
 * otro dominio. Esto es el segundo cerrojo, y cierra el hueco de las variantes: un `fetch` con
 * `credentials: 'include'` desde una página cualquiera, una etiqueta de imagen apuntando a un
 * DELETE, un formulario escondido. Cuesta dos cabeceras y no depende de que el navegador de
 * quien mira respete bien el `sameSite`.
 *
 * Sin `Origin` ni `Sec-Fetch-Site` **se deja pasar**: así son las peticiones de `curl` y de los
 * scripts de prueba, que ya necesitan la cookie para hacer algo.
 */
function deOtroSitio(peticion) {
  const sitio = peticion.headers.get('sec-fetch-site');
  if (sitio && sitio !== 'same-origin' && sitio !== 'none') return true;

  const origen = peticion.headers.get('origin');
  if (!origen) return false;

  try {
    const esperado = peticion.headers.get('host') ?? peticion.nextUrl.host;
    return new URL(origen).host !== esperado;
  } catch {
    return true;
  }
}

/**
 * La política de contenido. Lo que puede cargar la página, y de dónde.
 *
 * El nonce es lo que permite prohibir los scripts pegados en el HTML sin romper Next, que
 * necesita uno para arrancar: se le firma ese y ningún otro. Sin nonce habría que aceptar
 * `'unsafe-inline'`, y entonces la CSP no defendería de nada.
 *
 * `img-src` acepta cualquier `https:` **a propósito**: las capturas de devoluciones se pueden
 * pegar como enlace y ese enlace lo pone quien lo pega — puede ser de cualquier sitio.
 */
function politica(nonce, dev) {
  return [
    "default-src 'self'",
    // 'strict-dynamic' deja que el script de arranque cargue los demás bundles sin listarlos
    // uno por uno. En desarrollo Next compila con `eval`, y sin esto no levanta.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ''}`,
    // Los estilos en línea sí se aceptan: React los escribe en los atributos `style` y Next
    // inyecta el CSS así. No es lo mismo que un script: no ejecutan nada.
    //
    // Google Fonts está permitido por la página suelta de `public/`, que sí las pide de ahí.
    // La app no las necesita: `next/font` las descarga en el build y las sirve desde el propio
    // servidor, que es más rápido y no le cuenta a nadie quién entra.
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: blob: https:",
    "font-src 'self' https://fonts.gstatic.com",
    `connect-src 'self'${dev ? ' ws: http://localhost:*' : ''}`,
    "media-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    // Lo mismo que X-Frame-Options, en la versión que entienden los navegadores nuevos.
    "frame-ancestors 'none'",
    ...(dev ? [] : ['upgrade-insecure-requests']),
  ].join('; ');
}

const nonceNuevo = () => btoa(crypto.randomUUID()).replace(/=+$/, '');

export async function middleware(peticion) {
  // Las escrituras que vengan de otra página se cortan antes de llegar a la ruta.
  if (ESCRIBEN.has(peticion.method) && deOtroSitio(peticion)) {
    return NextResponse.json({ error: 'Petición de otro origen.' }, { status: 403 });
  }

  const nonce = nonceNuevo();
  const csp = politica(nonce, process.env.NODE_ENV !== 'production');

  // Next pone el nonce en sus propias etiquetas leyendo estas dos cabeceras de la petición.
  const cabeceras = new Headers(peticion.headers);
  cabeceras.set('x-nonce', nonce);
  cabeceras.set('content-security-policy', csp);

  const seguir = () => {
    const respuesta = NextResponse.next({ request: { headers: cabeceras } });
    respuesta.headers.set('content-security-policy', csp);
    return respuesta;
  };

  if (PUBLICAS.has(peticion.nextUrl.pathname)) return seguir();

  const sesion = await leerSesion(peticion.cookies.get(COOKIE)?.value);

  if (sesion) {
    const respuesta = seguir();

    // Renovar acá es lo que hace que la sesión de quien usa la app a diario no caduque nunca:
    // por el middleware pasa cada navegación y cada llamada a la API, y firmar no necesita la
    // base de datos. Se dispara a la mitad de la vida de la cookie, no en cada petición.
    if (hayQueRenovar(sesion.exp)) {
      const token = await firmarSesion(sesion.usuario);
      // Sin secreto no se puede firmar; se deja la que hay en vez de borrar la sesión.
      if (token) respuesta.cookies.set(COOKIE, token, opcionesCookie());
    }

    return respuesta;
  }

  const destino = peticion.nextUrl.clone();
  destino.pathname = '/login';
  destino.search = '';

  const respuesta = NextResponse.redirect(destino);
  // Cookie inválida o vencida: sacarla para no arrastrar basura.
  respuesta.cookies.delete(COOKIE);
  return respuesta;
}

// Todo pasa por el portero menos los estáticos. El login también pasa —sin comprobar sesión,
// por `PUBLICAS`— porque también necesita la CSP: es justo la página donde se escribe la clave.
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
