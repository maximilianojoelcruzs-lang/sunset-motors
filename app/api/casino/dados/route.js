import { NextResponse } from 'next/server';
import { exigirCasino } from '../../../../lib/servidor';
import { resolver, validarApuesta } from '../../../../lib/fichas';
import { resolverApuesta, tirar } from '../../../../lib/dados';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/casino/dados  body: { tipo, valor, apuesta } */
export async function POST(peticion) {
  const { sesion, corte } = await exigirCasino();
  if (corte) return corte;

  const { tipo, valor, apuesta } = await peticion.json().catch(() => ({}));

  try {
    const validada = await validarApuesta(sesion.usuario, apuesta);
    if (validada.error) return NextResponse.json({ error: validada.error }, { status: 400 });

    const dados = tirar();
    const jugada = resolverApuesta({ tipo, valor, apuesta: validada.apuesta, dados });
    if (jugada.error) return NextResponse.json({ error: jugada.error }, { status: 400 });

    const suma = dados[0] + dados[1] + dados[2];
    const { saldo, neto } = await resolver({
      usuario: sesion.usuario,
      juego: 'dados',
      apuesta: validada.apuesta,
      premio: jugada.premio,
      detalle: `${jugada.etiqueta} · salió ${dados.join('-')} (${suma})`,
    });

    return NextResponse.json({
      dados,
      suma,
      gano: jugada.gano,
      premio: jugada.premio,
      etiqueta: jugada.etiqueta,
      saldo,
      neto,
    });
  } catch (e) {
    return NextResponse.json({ error: `No se pudo jugar: ${e.message}` }, { status: 500 });
  }
}
