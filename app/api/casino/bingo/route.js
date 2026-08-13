import { NextResponse } from 'next/server';
import { sesionActual } from '../../../../lib/servidor';
import { esCasino } from '../../../../lib/usuarios';
import { saldoDe } from '../../../../lib/fichas';
import { PRECIO_CARTON, RITMO_MS } from '../../../../lib/bingo';
import { bolasCantadas, comprar, estado } from '../../../../lib/bingo-ronda';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Lo que ve el navegador.
 *
 * **Solo las bolas ya cantadas.** El orden completo se sortea al abrir la ronda y se queda en
 * el servidor: si viajara entero, cualquiera sabría con qué cartón va a ganar antes de
 * comprarlo. Los cartones de los demás sí van — en un bingo se ven todos.
 */
function vista(ronda, historial, usuario, saldo, ahora) {
  if (!ronda) {
    return { fase: 'sin-ronda', precio: PRECIO_CARTON, ritmo: RITMO_MS, historial, saldo };
  }

  const cantadas = bolasCantadas(ronda, ahora);

  return {
    fase: ronda.estado,
    id: ronda.id,
    precio: PRECIO_CARTON,
    ritmo: RITMO_MS,
    cierraVenta: ronda.cierraVenta,
    servidor: ahora,
    bolas: ronda.orden.slice(0, cantadas),
    cartones: ronda.cartones.map((c) => ({
      id: c.id,
      usuario: c.usuario,
      numeros: c.numeros,
      mio: c.usuario === usuario,
    })),
    historial,
    saldo,
  };
}

/** GET /api/casino/bingo → la ronda al día. */
export async function GET() {
  const sesion = await sesionActual();
  if (!sesion) return NextResponse.json({ error: 'Sin sesión.' }, { status: 401 });
  if (!(await esCasino(sesion.usuario))) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });
  }

  try {
    const ahora = Date.now();
    const { ronda, historial } = await estado(sesion.usuario, ahora);
    return NextResponse.json(
      vista(ronda, historial, sesion.usuario, await saldoDe(sesion.usuario), ahora)
    );
  } catch (e) {
    return NextResponse.json({ error: `No se pudo leer: ${e.message}` }, { status: 500 });
  }
}

/** POST /api/casino/bingo  body: { cartones } */
export async function POST(peticion) {
  const sesion = await sesionActual();
  if (!sesion) return NextResponse.json({ error: 'Sin sesión.' }, { status: 401 });
  if (!(await esCasino(sesion.usuario))) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });
  }

  const { cartones } = await peticion.json().catch(() => ({}));

  try {
    const ahora = Date.now();
    const cuantos = Math.round(Number(cartones ?? 1));

    if (cuantos * PRECIO_CARTON > (await saldoDe(sesion.usuario))) {
      return NextResponse.json({ error: 'No te alcanzan las fichas.' }, { status: 400 });
    }

    const { error, ronda, saldo } = await comprar(sesion.usuario, cuantos, ahora);
    if (error) return NextResponse.json({ error }, { status: 400 });

    const { historial } = await estado(sesion.usuario, ahora);
    return NextResponse.json(vista(ronda, historial, sesion.usuario, saldo, ahora));
  } catch (e) {
    return NextResponse.json({ error: `No se pudo comprar: ${e.message}` }, { status: 500 });
  }
}
