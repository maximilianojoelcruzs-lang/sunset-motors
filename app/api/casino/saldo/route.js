import { NextResponse } from 'next/server';
import { exigirCasino } from '../../../../lib/servidor';
import { jugadasDe, saldoDe } from '../../../../lib/fichas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/casino/saldo → fichas y últimas jugadas de quien pregunta. */
export async function GET() {
  const { sesion, corte } = await exigirCasino();
  if (corte) return corte;

  try {
    return NextResponse.json({
      saldo: await saldoDe(sesion.usuario),
      jugadas: await jugadasDe(sesion.usuario, 20),
    });
  } catch (e) {
    return NextResponse.json({ error: `No se pudo leer: ${e.message}` }, { status: 500 });
  }
}
