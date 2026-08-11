import { NextResponse } from 'next/server';
import { sesionActual } from '../../../../lib/servidor';
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
  const sesion = await sesionActual();
  if (!sesion) return NextResponse.json({ error: 'Sin sesión.' }, { status: 401 });

  try {
    return NextResponse.json({ turnos: await listar(sesion.usuario) });
  } catch (e) {
    return NextResponse.json({ error: `No se pudo leer: ${e.message}` }, { status: 500 });
  }
}
