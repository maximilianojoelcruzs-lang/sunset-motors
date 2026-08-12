import { NextResponse } from 'next/server';
import { sesionActual } from '../../../../lib/servidor';
import { esCasino } from '../../../../lib/usuarios';
import {
  resolver,
  saldoDe,
  esPilaDeFichas,
  APUESTA_MAXIMA,
  APUESTA_MINIMA,
} from '../../../../lib/fichas';
import { APUESTAS, repartir, resolverApuesta } from '../../../../lib/duelo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const no = (mensaje) => NextResponse.json({ error: mensaje }, { status: 400 });

/**
 * POST /api/casino/duelo  body: { apuestas: [{ id, monto }] }
 *
 * Se puede apostar a más de un sitio en la misma mano —al bando y al empate a la vez, que es
 * lo que hace media mesa en un casino de verdad—. Las dos cartas las reparte el servidor de
 * una sola vez: no hay nada que decidir después, así que no hace falta guardar el zapato.
 */
export async function POST(peticion) {
  const sesion = await sesionActual();
  if (!sesion) return NextResponse.json({ error: 'Sin sesión.' }, { status: 401 });
  if (!(await esCasino(sesion.usuario))) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });
  }

  const { apuestas } = await peticion.json().catch(() => ({}));

  try {
    if (!Array.isArray(apuestas) || apuestas.length === 0) return no('Pon una ficha primero.');
    if (apuestas.length > 3) return no('Solo hay tres sitios en la mesa.');

    const vistos = new Set();
    const limpias = [];
    for (const cruda of apuestas) {
      const def = APUESTAS[cruda?.id];
      if (!def) return no('Esa apuesta no existe en la mesa.');
      if (vistos.has(cruda.id)) return no('Hay dos fichas al mismo sitio.');
      vistos.add(cruda.id);

      const monto = Math.round(Number(cruda.monto));
      if (!esPilaDeFichas(monto)) {
        return no(`Se apuesta con fichas: ${APUESTA_MINIMA}, 100, 500, 1.000 o 5.000.`);
      }
      if (monto > APUESTA_MAXIMA) return no(`El máximo por sitio es ${APUESTA_MAXIMA}.`);
      limpias.push({ id: cruda.id, monto });
    }

    const total = limpias.reduce((s, a) => s + a.monto, 0);
    if (total > (await saldoDe(sesion.usuario))) return no('No te alcanzan las fichas.');

    const mano = repartir();
    const resultados = limpias.map((a) => resolverApuesta({ ...a, ganador: mano.ganador }));
    const premio = resultados.reduce((s, r) => s + r.premio, 0);

    const { saldo, neto } = await resolver({
      usuario: sesion.usuario,
      juego: 'duelo',
      apuesta: total,
      premio,
      detalle: `Ganó ${APUESTAS[mano.ganador]?.etiqueta ?? 'el empate'} · ${limpias.length} ficha(s)`,
    });

    return NextResponse.json({
      rojo: mano.rojo,
      azul: mano.azul,
      ganador: mano.ganador,
      resultados,
      apuestaTotal: total,
      premio,
      neto,
      saldo,
      gano: premio > total,
    });
  } catch (e) {
    return NextResponse.json({ error: `No se pudo repartir: ${e.message}` }, { status: 500 });
  }
}
