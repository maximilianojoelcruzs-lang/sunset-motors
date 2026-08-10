import { NextResponse } from 'next/server';
import { COOKIE, HORAS, firmarSesion, secretoFirma } from '../../../lib/sesion';
import { hayUsuarios, verificarUsuario } from '../../../lib/usuarios';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(peticion) {
  const { usuario, clave } = await peticion.json().catch(() => ({}));

  if (!secretoFirma()) {
    return NextResponse.json(
      { error: 'Falta configurar SUNSET_SECRETO en el servidor.' },
      { status: 500 }
    );
  }

  if (!usuario || !clave) {
    return NextResponse.json({ error: 'Faltan el usuario o la clave.' }, { status: 400 });
  }

  try {
    if (!(await hayUsuarios())) {
      return NextResponse.json(
        { error: 'Todavía no hay ningún usuario creado en este taller.' },
        { status: 503 }
      );
    }

    const verificado = await verificarUsuario(usuario, clave);
    if (!verificado) {
      // Un solo mensaje para usuario inexistente y clave mala: no regalamos qué falló.
      return NextResponse.json({ error: 'Usuario o clave incorrectos.' }, { status: 401 });
    }

    const respuesta = NextResponse.json({ ok: true });
    respuesta.cookies.set(COOKIE, await firmarSesion(verificado), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: HORAS * 3600,
    });
    return respuesta;
  } catch (e) {
    return NextResponse.json(
      { error: `No se pudo consultar la base de usuarios: ${e.message}` },
      { status: 500 }
    );
  }
}
