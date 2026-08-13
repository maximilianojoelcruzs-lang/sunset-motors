import { NextResponse } from 'next/server';
import { sesionActual } from '../../../lib/servidor';
import { soloCasino } from '../../../lib/usuarios';
import { crear, listar } from '../../../lib/tunning';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Los pedidos son del taller: un invitado del casino no tiene nada que hacer acá. */
async function exigirTaller() {
  const sesion = await sesionActual();
  if (!sesion) return { corte: NextResponse.json({ error: 'Sin sesión.' }, { status: 401 }) };
  if (await soloCasino(sesion.usuario)) {
    return { corte: NextResponse.json({ error: 'No autorizado.' }, { status: 403 }) };
  }
  return { sesion };
}

/**
 * GET /api/tunning → todos los pedidos.
 *
 * Los ve todo el taller a propósito: dos mecánicos pueden estar con el mismo auto, y el
 * sentido de la lista es justamente que los dos vean lo mismo.
 */
export async function GET() {
  const { corte } = await exigirTaller();
  if (corte) return corte;

  try {
    return NextResponse.json({ pedidos: await listar() });
  } catch (e) {
    return NextResponse.json({ error: `No se pudo leer: ${e.message}` }, { status: 500 });
  }
}

/** POST /api/tunning  body: { patente } */
export async function POST(peticion) {
  const { sesion, corte } = await exigirTaller();
  if (corte) return corte;

  const { patente } = await peticion.json().catch(() => ({}));

  try {
    const { error, pedido } = await crear(sesion.usuario, patente);
    if (error) return NextResponse.json({ error }, { status: 400 });
    return NextResponse.json({ pedido });
  } catch (e) {
    return NextResponse.json({ error: `No se pudo crear: ${e.message}` }, { status: 500 });
  }
}
