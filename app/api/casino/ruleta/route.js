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
import { apuestaPorId, color, girar, resolverApuesta } from '../../../../lib/ruleta';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Cuántas fichas se pueden repartir en el paño de una sola tirada. */
const MAX_APUESTAS = 40;

const no = (mensaje) => NextResponse.json({ error: mensaje }, { status: 400 });

/**
 * POST /api/casino/ruleta  body: { apuestas: [{ id, monto }] }
 *
 * **El número lo saca el servidor.** El navegador solo manda dónde puso cada ficha; recibe
 * el número ya sorteado y lo anima. Si la tirada ocurriera en el cliente, cualquiera con
 * las herramientas de desarrollo se declararía ganador de todo.
 *
 * Manda **el sitio** de cada ficha y no la lista de números que cubre: así no hay forma de
 * pedir un caballo de dos números que en una mesa real no se tocan, ni de cobrar un pago que
 * no corresponda. El descuento del saldo también es de acá: el cliente no resta nada.
 */
export async function POST(peticion) {
  const sesion = await sesionActual();
  if (!sesion) return NextResponse.json({ error: 'Sin sesión.' }, { status: 401 });
  if (!(await esCasino(sesion.usuario))) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });
  }

  const { apuestas } = await peticion.json().catch(() => ({}));

  try {
    if (!Array.isArray(apuestas) || apuestas.length === 0) {
      return no('Pon al menos una ficha en el paño.');
    }
    if (apuestas.length > MAX_APUESTAS) {
      return no(`No puedes poner más de ${MAX_APUESTAS} fichas en una tirada.`);
    }

    // Cada ficha se valida por separado, y el total contra el saldo. Un id repetido se
    // rechaza: si no, dos fichas al mismo sitio contarían distinto según cómo se sumaran.
    const vistos = new Set();
    const limpias = [];

    for (const cruda of apuestas) {
      const def = apuestaPorId(cruda?.id);
      if (!def) return no('Esa apuesta no existe en la mesa.');
      if (vistos.has(def.id)) return no('Hay dos fichas al mismo sitio.');
      vistos.add(def.id);

      const monto = Math.round(Number(cruda.monto));
      // Tiene que ser una pila de fichas de verdad. En pantalla no se puede poner otra cosa,
      // pero eso es la pantalla: sin esto, cualquiera manda 501 por la API.
      if (!esPilaDeFichas(monto)) {
        return no(`En cada sitio van fichas: ${APUESTA_MINIMA}, 100, 500, 1.000 o 5.000.`);
      }
      if (monto > APUESTA_MAXIMA) {
        return no(`Cada sitio puede llevar ${APUESTA_MAXIMA} como mucho.`);
      }
      limpias.push({ id: def.id, monto });
    }

    const total = limpias.reduce((s, a) => s + a.monto, 0);
    if (total > (await saldoDe(sesion.usuario))) {
      return no('No te alcanzan las fichas para todo lo que pusiste.');
    }

    const numero = girar();
    const resultados = limpias.map((a) => resolverApuesta({ ...a, numero }));
    const premio = resultados.reduce((s, r) => s + r.premio, 0);
    const ganadoras = resultados.filter((r) => r.gano);

    const { saldo, neto } = await resolver({
      usuario: sesion.usuario,
      juego: 'ruleta',
      apuesta: total,
      premio,
      detalle:
        `Salió ${numero} ${color(numero)} · ${limpias.length} ficha(s)` +
        (ganadoras.length
          ? `, acertó ${ganadoras.map((r) => r.etiqueta).join(' y ')}`
          : ', ninguna acertó'),
    });

    return NextResponse.json({
      numero,
      color: color(numero),
      resultados,
      apuestaTotal: total,
      premio,
      neto,
      saldo,
      gano: premio > 0,
    });
  } catch (e) {
    return NextResponse.json({ error: `No se pudo jugar: ${e.message}` }, { status: 500 });
  }
}
