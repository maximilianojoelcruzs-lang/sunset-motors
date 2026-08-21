import { NextResponse } from 'next/server';
import { exigirCasino } from '../../../../lib/servidor';
import { saldoDe } from '../../../../lib/fichas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/casino/saldo → las fichas de quien pregunta, y nada más.
 *
 * Lo consulta la pantalla cada 20 segundos, así que devuelve **solo el saldo**: antes traía
 * también las últimas 20 jugadas, que nadie usaba y costaban una lectura entera de la colección
 * del registro en cada consulta. Las jugadas de todo el mundo las lista `/api/casino/fichas`,
 * que es del encargado.
 */
export async function GET() {
  const { sesion, corte } = await exigirCasino();
  if (corte) return corte;

  try {
    return NextResponse.json({ saldo: await saldoDe(sesion.usuario) });
  } catch (e) {
    return NextResponse.json({ error: `No se pudo leer: ${e.message}` }, { status: 500 });
  }
}
