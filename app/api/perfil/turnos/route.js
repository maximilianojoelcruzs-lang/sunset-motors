import { NextResponse } from 'next/server';
import { exigirSesion } from '../../../../lib/servidor';
import { listar } from '../../../../lib/turnos';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/perfil/turnos → los turnos de quien pide, y solo los suyos.
 *
 * No confundir con GET /api/turnos, que entrega el registro completo del taller y sigue
 * siendo exclusivo de administradores. Acá el usuario sale de la cookie, nunca de un
 * parámetro: no hay forma de pedir los turnos de otra persona.
 */
export async function GET() {
  const { sesion, corte } = await exigirSesion();
  if (corte) return corte;

  try {
    return NextResponse.json({ turnos: await listar(sesion.usuario) });
  } catch (e) {
    return NextResponse.json({ error: `No se pudo leer: ${e.message}` }, { status: 500 });
  }
}
