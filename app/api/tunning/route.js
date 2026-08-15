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
 * GET /api/tunning → los pedidos de quien pregunta, y solo los suyos.
 *
 * Antes eran los del taller entero. Con dos mecánicos trabajando a la vez, el segundo abría la
 * pantalla y caía sobre el pedido del primero, y se escribían encima.
 */
export async function GET() {
  const { sesion, corte } = await exigirTaller();
  if (corte) return corte;

  try {
    return NextResponse.json({ pedidos: await listar(sesion.usuario) });
  } catch (e) {
    return NextResponse.json({ error: `No se pudo leer: ${e.message}` }, { status: 500 });
  }
}

/**
 * POST /api/tunning  body: { piezas: [{ categoria, etiqueta, valor }] }
 *
 * Las piezas van en la misma llamada que la creación a propósito: pegar un pedido de treinta
 * líneas tiene que ser una escritura, no una más treinta.
 */
export async function POST(peticion) {
  const { sesion, corte } = await exigirTaller();
  if (corte) return corte;

  const { piezas } = await peticion.json().catch(() => ({}));

  try {
    const { error, pedido } = await crear(sesion.usuario, Array.isArray(piezas) ? piezas : []);
    if (error) return NextResponse.json({ error }, { status: 400 });
    return NextResponse.json({ pedido });
  } catch (e) {
    return NextResponse.json({ error: `No se pudo crear: ${e.message}` }, { status: 500 });
  }
}
