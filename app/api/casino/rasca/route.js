import { NextResponse } from 'next/server';
import { sesionActual } from '../../../../lib/servidor';
import { esCasino } from '../../../../lib/usuarios';
import { resolver, validarApuesta } from '../../../../lib/fichas';
import { rascar } from '../../../../lib/rasca';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/casino/rasca  body: { apuesta }
 *
 * El cartón viene ya resuelto del servidor. El navegador solo lo va destapando: raspar más
 * rápido o más lento no cambia nada, igual que con un raspadito de papel.
 */
export async function POST(peticion) {
  const sesion = await sesionActual();
  if (!sesion) return NextResponse.json({ error: 'Sin sesión.' }, { status: 401 });
  if (!(await esCasino(sesion.usuario))) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });
  }

  const { apuesta } = await peticion.json().catch(() => ({}));

  try {
    const validada = await validarApuesta(sesion.usuario, apuesta);
    if (validada.error) return NextResponse.json({ error: validada.error }, { status: 400 });

    const carton = rascar(validada.apuesta);

    const { saldo, neto } = await resolver({
      usuario: sesion.usuario,
      juego: 'rasca',
      apuesta: validada.apuesta,
      premio: carton.premio,
      detalle: carton.gano ? `Ganó x${carton.multiplicador}` : 'Sin premio',
    });

    return NextResponse.json({ ...carton, saldo, neto });
  } catch (e) {
    return NextResponse.json({ error: `No se pudo jugar: ${e.message}` }, { status: 500 });
  }
}
