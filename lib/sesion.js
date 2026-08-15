// Sesión sin base de datos: la cookie lleva el usuario firmado con HMAC-SHA256.
// Usa Web Crypto, así que corre igual en el middleware (Edge) y en los route handlers.
//
// La llave de firma es SUNSET_SECRETO, aparte de las claves de los usuarios: así los
// hashes de lib/usuarios.js pueden vivir en el repo sin que nadie pueda fabricarse
// una cookie válida. Cambiar el secreto cierra todas las sesiones abiertas de golpe.

const COD = new TextEncoder();
const DEC = new TextDecoder();

export const COOKIE = 'sunset_sesion';

// Un turno de rol dura horas y se entra y se sale de la página todo el rato; con 12 horas la
// sesión se caía a media tarde y había que volver a escribir la clave. Ahora dura 30 días y,
// además, **se renueva sola mientras se usa** (ver `hayQueRenovar` y el middleware): quien
// entra a diario no vuelve a ver el login. Es un tope absoluto, no un olvido.
export const HORAS = 24 * 30;

/**
 * ¿Toca refrescar la cookie? Sí cuando ya se gastó la mitad de su vida.
 *
 * Renovar en cada petición sería mandar una cookie nueva en cada sondeo de 15 segundos para
 * nada. A la mitad basta: mientras alguien entre una vez cada quince días, su sesión nunca
 * caduca, y quien deje de entrar la pierde igual a los 30.
 */
export const hayQueRenovar = (exp) => exp - Date.now() < (HORAS * 3600 * 1000) / 2;

/** Las mismas opciones en el login y en la renovación: si difieren, quedan dos cookies. */
export const opcionesCookie = () => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: HORAS * 3600,
});

/** Llave para firmar cookies. En dev cae a un valor fijo; en producción no hay respaldo. */
export function secretoFirma() {
  const desdeEntorno = process.env.SUNSET_SECRETO;
  if (desdeEntorno) return desdeEntorno;
  return process.env.NODE_ENV === 'production' ? null : 'secreto-solo-para-desarrollo';
}

const aB64u = (bytes) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

const deB64u = (texto) => {
  const b64 = texto.replace(/-/g, '+').replace(/_/g, '/');
  const relleno = '='.repeat((4 - (b64.length % 4)) % 4);
  return Uint8Array.from(atob(b64 + relleno), (c) => c.charCodeAt(0));
};

async function llave() {
  const secreto = secretoFirma();
  if (!secreto) return null;
  return crypto.subtle.importKey(
    'raw',
    COD.encode(secreto),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

/** Arma el valor de la cookie para un usuario ya verificado. */
export async function firmarSesion(usuario) {
  const k = await llave();
  if (!k) return null;
  const cuerpo = aB64u(
    COD.encode(JSON.stringify({ u: usuario, exp: Date.now() + HORAS * 3600 * 1000 }))
  );
  const firma = await crypto.subtle.sign('HMAC', k, COD.encode(cuerpo));
  return `${cuerpo}.${aB64u(firma)}`;
}

/** Devuelve { usuario, exp } si la cookie es legítima y no caducó; si no, null. */
export async function leerSesion(token) {
  if (!token) return null;
  const [cuerpo, firma] = token.split('.');
  if (!cuerpo || !firma) return null;

  const k = await llave();
  if (!k) return null;

  try {
    const valida = await crypto.subtle.verify('HMAC', k, deB64u(firma), COD.encode(cuerpo));
    if (!valida) return null;

    const { u, exp } = JSON.parse(DEC.decode(deB64u(cuerpo)));
    if (!u || !exp || Date.now() > exp) return null;
    // `exp` sale también porque el middleware lo necesita para decidir si renueva.
    return { usuario: u, exp };
  } catch {
    return null;
  }
}
