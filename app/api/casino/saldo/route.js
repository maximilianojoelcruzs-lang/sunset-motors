import { NextResponse } from 'next/server';
import { sesionActual } from '../../../../lib/servidor';
import { esCasino } from '../../../../lib/usuarios';
import { jugadasDe, saldoDe } from '../../../../lib/fichas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/casino/saldo → fichas y últimas jugadas de quien pregunta. */
export async function GET() {
  const sesion = await sesionActual();
  if (!sesion) return NextResponse.json({ error: 'Sin sesión.' }, { status: 401 });
  if (!(await esCasino(sesion.usuario))) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });
  }

  try {
    return NextResponse.json({
      saldo: await saldoDe(sesion.usuario),
      jugadas: await jugadasDe(sesion.usuario, 20),
    });
  } catch (e) {
    return NextResponse.json({ error: `No se pudo leer: ${e.message}` }, { status: 500 });
  }
}
