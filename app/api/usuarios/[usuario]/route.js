import { NextResponse } from 'next/server';
import { sesionActual } from '../../../../lib/servidor';
import {
  borrarUsuario,
  cambiarClave,
  cambiarDiscord,
  cambiarRol,
  esAdmin,
} from '../../../../lib/usuarios';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function exigirAdmin() {
  const sesion = await sesionActual();
  if (!sesion) return { corte: NextResponse.json({ error: 'Sin sesión.' }, { status: 401 }) };
  if (!(await esAdmin(sesion.usuario))) {
    return { corte: NextResponse.json({ error: 'No autorizado.' }, { status: 403 }) };
  }
  return { sesion };
}

/** PATCH body: { admin } o { clave } */
export async function PATCH(peticion, { params }) {
  const { sesion, corte } = await exigirAdmin();
  if (corte) return corte;

  const { usuario } = await params;
  const cambios = await peticion.json().catch(() => ({}));

  try {
    if (typeof cambios.clave === 'string') {
      const { error } = await cambiarClave(usuario, cambios.clave);
      if (error) return NextResponse.json({ error }, { status: 400 });
      return NextResponse.json({ ok: true });
    }

    if (typeof cambios.discord === 'string') {
      const { error } = await cambiarDiscord(usuario, cambios.discord);
      if (error) return NextResponse.json({ error }, { status: 400 });
      return NextResponse.json({ ok: true });
    }

    if (typeof cambios.admin === 'boolean') {
      // Quitarse el rol a uno mismo deja la sesión sin panel al siguiente clic, sin aviso.
      if (!cambios.admin && usuario.toLowerCase() === sesion.usuario.toLowerCase()) {
        return NextResponse.json(
          { error: 'No puedes quitarte a ti mismo el rol de administrador.' },
          { status: 400 }
        );
      }
      const { error } = await cambiarRol(usuario, cambios.admin);
      if (error) return NextResponse.json({ error }, { status: 400 });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Nada que cambiar.' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: `No se pudo guardar: ${e.message}` }, { status: 500 });
  }
}

export async function DELETE(peticion, { params }) {
  const { sesion, corte } = await exigirAdmin();
  if (corte) return corte;

  const { usuario } = await params;

  if (usuario.toLowerCase() === sesion.usuario.toLowerCase()) {
    return NextResponse.json({ error: 'No puedes borrar tu propia cuenta.' }, { status: 400 });
  }

  try {
    const { error } = await borrarUsuario(usuario);
    if (error) return NextResponse.json({ error }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: `No se pudo borrar: ${e.message}` }, { status: 500 });
  }
}
