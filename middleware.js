import { NextResponse } from 'next/server';
import { COOKIE, firmarSesion, hayQueRenovar, leerSesion, opcionesCookie } from './lib/sesion';

// Acá solo se comprueba que haya sesión. El rol NO se mira aquí: el middleware corre en
// Edge y no puede leer la base de datos donde viven los usuarios. Quién es administrador
// lo deciden la página /admin y los route handlers, que corren en Node — y que de todos
// modos son los que tienen que decidirlo, porque son los que entregan los datos.
//
// Sí es el sitio para **renovar la cookie**: pasa por acá cada navegación y cada llamada a la
// API, y firmar no necesita la base de datos. Con eso la sesión de quien usa la app a diario
// no caduca nunca, sin dejarla abierta para siempre a quien no vuelve.
export async function middleware(peticion) {
  const sesion = await leerSesion(peticion.cookies.get(COOKIE)?.value);

  if (sesion) {
    if (!hayQueRenovar(sesion.exp)) return NextResponse.next();

    const respuesta = NextResponse.next();
    const token = await firmarSesion(sesion.usuario);
    // Sin secreto no se puede firmar; se deja la que hay en vez de borrar la sesión.
    if (token) respuesta.cookies.set(COOKIE, token, opcionesCookie());
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

// Todo pasa por el portero menos el propio login y los estáticos.
export const config = {
  matcher: ['/((?!login|api/login|_next/static|_next/image|favicon.ico).*)'],
};
