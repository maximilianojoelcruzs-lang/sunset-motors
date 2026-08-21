import { NextResponse } from 'next/server';
import { exigirCasino } from '../../../../lib/servidor';
import { resolver, validarApuesta } from '../../../../lib/fichas';
import { girar } from '../../../../lib/tragamonedas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/casino/tragamonedas  body: { apuesta } */
export async function POST(peticion) {
  const { sesion, corte } = await exigirCasino();
  if (corte) return corte;

  const { apuesta } = await peticion.json().catch(() => ({}));

  try {
    const validada = await validarApuesta(sesion.usuario, apuesta);
    if (validada.error) return NextResponse.json({ error: validada.error }, { status: 400 });

    const tirada = girar(validada.apuesta);

    const { saldo, neto } = await resolver({
      usuario: sesion.usuario,
      juego: 'tragamonedas',
      apuesta: validada.apuesta,
      premio: tirada.premio,
      detalle: tirada.linea
        ? `${tirada.linea} (x${tirada.multiplicador})`
        : `${tirada.simbolos.join(' ')} · sin premio`,
    });

    return NextResponse.json({ ...tirada, saldo, neto, gano: tirada.premio > 0 });
  } catch (e) {
    return NextResponse.json({ error: `No se pudo jugar: ${e.message}` }, { status: 500 });
  }
}
