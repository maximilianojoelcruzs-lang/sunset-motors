import { NextResponse } from 'next/server';
import { sesionActual } from '../../../../lib/servidor';
import { esCasino } from '../../../../lib/usuarios';
import { resolver, validarApuesta } from '../../../../lib/fichas';
import { TABLAS, soltar } from '../../../../lib/plinko';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/casino/plinko  body: { apuesta, riesgo } */
export async function POST(peticion) {
  const sesion = await sesionActual();
  if (!sesion) return NextResponse.json({ error: 'Sin sesión.' }, { status: 401 });
  if (!(await esCasino(sesion.usuario))) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });
  }

  const { apuesta, riesgo } = await peticion.json().catch(() => ({}));

  try {
    if (!TABLAS[riesgo]) {
      return NextResponse.json({ error: 'Ese nivel de riesgo no existe.' }, { status: 400 });
    }

    const validada = await validarApuesta(sesion.usuario, apuesta);
    if (validada.error) return NextResponse.json({ error: validada.error }, { status: 400 });

    // El camino lo sortea el servidor entero, antes de que el navegador anime nada: lo que
    // se ve caer es el resultado ya decidido, no un cálculo del cliente.
    const tirada = soltar(validada.apuesta, riesgo);

    const { saldo, neto } = await resolver({
      usuario: sesion.usuario,
      juego: 'plinko',
      apuesta: validada.apuesta,
      premio: tirada.premio,
      detalle: `Riesgo ${TABLAS[riesgo].nombre.toLowerCase()} · casilla ${tirada.casilla} · x${tirada.multiplicador}`,
    });

    return NextResponse.json({ ...tirada, saldo, neto, gano: tirada.premio > validada.apuesta });
  } catch (e) {
    return NextResponse.json({ error: `No se pudo jugar: ${e.message}` }, { status: 500 });
  }
}
