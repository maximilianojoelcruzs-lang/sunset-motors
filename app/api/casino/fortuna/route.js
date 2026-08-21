import { NextResponse } from 'next/server';
import { exigirCasino } from '../../../../lib/servidor';
import { resolver, validarApuesta } from '../../../../lib/fichas';
import { girar } from '../../../../lib/fortuna';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/casino/fortuna  body: { apuesta } */
export async function POST(peticion) {
  const { sesion, corte } = await exigirCasino();
  if (corte) return corte;

  const { apuesta } = await peticion.json().catch(() => ({}));

  try {
    const validada = await validarApuesta(sesion.usuario, apuesta);
    if (validada.error) return NextResponse.json({ error: validada.error }, { status: 400 });

    // El gajo lo saca el servidor. La rueda de la pantalla gira **hacia** el que ya salió.
    const tirada = girar(validada.apuesta);

    const { saldo, neto } = await resolver({
      usuario: sesion.usuario,
      juego: 'fortuna',
      apuesta: validada.apuesta,
      premio: tirada.premio,
      detalle: tirada.multiplicador
        ? `Cayó en x${tirada.multiplicador}`
        : 'Cayó en un gajo vacío',
    });

    return NextResponse.json({
      ...tirada,
      saldo,
      neto,
      gano: tirada.premio > validada.apuesta,
    });
  } catch (e) {
    return NextResponse.json({ error: `No se pudo girar: ${e.message}` }, { status: 500 });
  }
}
