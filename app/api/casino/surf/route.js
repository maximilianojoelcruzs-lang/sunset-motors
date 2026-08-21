import { NextResponse } from 'next/server';
import { exigirCasino } from '../../../../lib/servidor';
import {
  resolver,
  saldoDe,
  esPilaDeFichas,
  APUESTA_MAXIMA,
  APUESTA_MINIMA,
} from '../../../../lib/fichas';
import { SURFISTAS, correr, resolverApuesta, surfista } from '../../../../lib/surf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const no = (mensaje) => NextResponse.json({ error: mensaje }, { status: 400 });

/**
 * POST /api/casino/surf  body: { apuestas: [{ id, monto }] }
 *
 * Se puede repartir entre varios surfistas en la misma ola, igual que en el paño de la
 * ruleta. El orden de llegada lo sortea el servidor entero antes de responder: lo que el
 * navegador anima es una carrera que ya se corrió.
 */
export async function POST(peticion) {
  const { sesion, corte } = await exigirCasino();
  if (corte) return corte;

  const { apuestas } = await peticion.json().catch(() => ({}));

  try {
    if (!Array.isArray(apuestas) || apuestas.length === 0) {
      return no('Apuesta a alguien antes de largar.');
    }
    if (apuestas.length > SURFISTAS.length) return no('Hay más apuestas que surfistas.');

    const vistos = new Set();
    const limpias = [];
    for (const cruda of apuestas) {
      const quien = surfista(cruda?.id);
      if (!quien) return no('Ese surfista no compite.');
      if (vistos.has(quien.id)) return no('Hay dos apuestas al mismo surfista.');
      vistos.add(quien.id);

      const monto = Math.round(Number(cruda.monto));
      if (!esPilaDeFichas(monto)) {
        return no(`Se apuesta con fichas: ${APUESTA_MINIMA}, 100, 500, 1.000 o 5.000.`);
      }
      if (monto > APUESTA_MAXIMA) return no(`El máximo por surfista es ${APUESTA_MAXIMA}.`);
      limpias.push({ id: quien.id, monto });
    }

    const total = limpias.reduce((s, a) => s + a.monto, 0);
    if (total > (await saldoDe(sesion.usuario))) return no('No te alcanzan las fichas.');

    const orden = correr();
    const resultados = limpias.map((a) => resolverApuesta({ ...a, orden }));
    const premio = resultados.reduce((s, r) => s + r.premio, 0);
    const ganador = surfista(orden[0]);

    const { saldo, neto } = await resolver({
      usuario: sesion.usuario,
      juego: 'surf',
      apuesta: total,
      premio,
      detalle: `Ganó ${ganador.nombre} · ${limpias.length} apuesta(s)`,
    });

    return NextResponse.json({
      orden,
      resultados,
      apuestaTotal: total,
      premio,
      neto,
      saldo,
      gano: premio > 0,
    });
  } catch (e) {
    return NextResponse.json({ error: `No se pudo correr: ${e.message}` }, { status: 500 });
  }
}
