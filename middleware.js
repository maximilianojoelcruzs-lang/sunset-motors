import { NextResponse } from 'next/server';
import { COOKIE, leerSesion } from './lib/sesion';

// Acá solo se comprueba que haya sesión. El rol NO se mira aquí: el middleware corre en
// Edge y no puede leer la base de datos donde viven los usuarios. Quién es administrador
// lo deciden la página /admin y los route handlers, que corren en Node — y que de todos
// modos son los que tienen que decidirlo, porque son los que entregan los datos.
export async function middleware(peticion) {
  const sesion = await leerSesion(peticion.cookies.get(COOKIE)?.value);
  if (sesion) return NextResponse.next();

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
