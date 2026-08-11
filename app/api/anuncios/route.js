import { NextResponse } from 'next/server';
import { sesionActual } from '../../../lib/servidor';
import { esAdmin } from '../../../lib/usuarios';
import { crearMensaje, listarMensajes } from '../../../lib/anuncios';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/anuncios → los mensajes guardados. Todo el taller los usa para copiar. */
export async function GET() {
  const sesion = await sesionActual();
  if (!sesion) return NextResponse.json({ error: 'Sin sesión.' }, { status: 401 });

  try {
    return NextResponse.json({ mensajes: await listarMensajes() });
  } catch (e) {
    return NextResponse.json({ error: `No se pudo leer: ${e.message}` }, { status: 500 });
  }
}

/** POST /api/anuncios  body: { titulo, texto }. Solo administradores. */
export async function POST(peticion) {
  const sesion = await sesionActual();
  if (!sesion) return NextResponse.json({ error: 'Sin sesión.' }, { status: 401 });
  if (!(await esAdmin(sesion.usuario))) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });
  }

  const datos = await peticion.json().catch(() => ({}));

  try {
    const { error, mensaje } = await crearMensaje(sesion.usuario, datos);
    if (error) return NextResponse.json({ error }, { status: 400 });
    return NextResponse.json({ mensaje });
  } catch (e) {
    return NextResponse.json({ error: `No se pudo guardar: ${e.message}` }, { status: 500 });
  }
}
