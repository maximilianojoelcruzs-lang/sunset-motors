import { NextResponse } from 'next/server';
import { exigirSesion } from '../../../../lib/servidor';
import { cambiarClavePropia } from '../../../../lib/usuarios';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/perfil/clave  body: { actual, nueva }
 *
 * Cambia la clave de quien tiene la sesión, y solo la suya. El usuario NO se toma del
 * cuerpo de la petición sino de la cookie: si viniera del cuerpo, cualquiera podría
 * cambiarle la clave a otro.
 */
export async function POST(peticion) {
  const { sesion, corte } = await exigirSesion();
  if (corte) return corte;

  const { actual, nueva } = await peticion.json().catch(() => ({}));
  if (!actual || !nueva) {
    return NextResponse.json({ error: 'Faltan la clave actual o la nueva.' }, { status: 400 });
  }

  try {
    const { error } = await cambiarClavePropia(sesion.usuario, actual, nueva);
    if (error) return NextResponse.json({ error }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: `No se pudo guardar: ${e.message}` }, { status: 500 });
  }
}
