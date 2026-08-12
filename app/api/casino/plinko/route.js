import { NextResponse } from 'next/server';
import { sesionActual } from '../../../../lib/servidor';
import { esCasino } from '../../../../lib/usuarios';
import { resolver, saldoDe, validarApuesta } from '../../../../lib/fichas';
import { TABLAS, soltarVarias } from '../../../../lib/plinko';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/casino/plinko  body: { apuesta, riesgo, bolitas } */
export async function POST(peticion) {
  const sesion = await sesionActual();
  if (!sesion) return NextResponse.json({ error: 'Sin sesión.' }, { status: 401 });
  if (!(await esCasino(sesion.usuario))) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });
  }

  const { apuesta, riesgo, bolitas } = await peticion.json().catch(() => ({}));

  try {
    if (!TABLAS[riesgo]) {
      return NextResponse.json({ error: 'Ese nivel de riesgo no existe.' }, { status: 400 });
    }

    // La apuesta es **por bolita**: se valida una y después se comprueba el puñado entero
    // contra el saldo. Si no, con diez bolitas se podría apostar diez veces lo que se tiene.
    const validada = await validarApuesta(sesion.usuario, apuesta);
    if (validada.error) return NextResponse.json({ error: validada.error }, { status: 400 });

    // Los caminos los sortea el servidor enteros, antes de que el navegador anime nada.
    const tirada = soltarVarias(validada.apuesta, riesgo, bolitas);
    if (tirada.error) return NextResponse.json({ error: tirada.error }, { status: 400 });

    if (tirada.apuestaTotal > (await saldoDe(sesion.usuario))) {
      return NextResponse.json(
        { error: `No te alcanzan las fichas para ${tirada.bolitas} bolitas.` },
        { status: 400 }
      );
    }

    const casillas = tirada.tiradas.map((t) => t.casilla).join(', ');
    const { saldo, neto } = await resolver({
      usuario: sesion.usuario,
      juego: 'plinko',
      apuesta: tirada.apuestaTotal,
      premio: tirada.premio,
      detalle: `Riesgo ${TABLAS[riesgo].nombre.toLowerCase()} · ${tirada.bolitas} bolita(s) · casillas ${casillas}`,
    });

    return NextResponse.json({
      ...tirada,
      saldo,
      neto,
      gano: tirada.premio > tirada.apuestaTotal,
    });
  } catch (e) {
    return NextResponse.json({ error: `No se pudo jugar: ${e.message}` }, { status: 500 });
  }
}
