import { NextResponse } from 'next/server';
import { exigirCasino } from '../../../../lib/servidor';
import { cobrar, pagar, saldoDe, validarApuesta } from '../../../../lib/fichas';
import {
  acciones,
  crearZapato,
  crupierAsoma,
  esBlackjack,
  juegaCrupier,
  resolverMano,
  valor,
  vista,
} from '../../../../lib/blackjack';
import {
  guardarPartidaDe,
  leerPartidas,
  olvidarPartidaDe,
} from '../../../../lib/blackjack-partida';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const no = (mensaje, estado) => NextResponse.json({ error: mensaje }, { status: estado });

/** Sirve la segunda carta a una mano recién separada, y planta la de ases. */
function servir(partida) {
  const mano = partida.manos[partida.activa];
  if (mano.cartas.length === 1) {
    mano.cartas.push(partida.zapato.shift());
    // Los ases separados reciben una carta y se plantan: no se pide más ni se vuelve a separar.
    if (mano.deAs) mano.plantada = true;
  }
}

/**
 * Pasa a la siguiente mano que todavía pueda jugar. Devuelve true cuando ya no queda
 * ninguna: ahí le toca al crupier.
 */
function avanzar(partida) {
  while (partida.activa < partida.manos.length) {
    servir(partida);
    const mano = partida.manos[partida.activa];
    const v = valor(mano.cartas);
    if (!mano.plantada && !v.pasada && v.total < 21) return false;
    partida.activa += 1;
  }
  return true;
}

/**
 * Destapa, juega el crupier si hace falta, paga todo junto y borra la partida.
 *
 * Recibe el mapa que ya se leyó y lo escribe una sola vez: volver a leerlo para borrar una
 * clave sería un viaje de más contra la base.
 */
async function cerrar(usuario, partida, todas) {
  // El crupier solo roba si queda algo que decidir. Con todas las manos pasadas ya cobró, y
  // contra un blackjack servido tampoco hay nada que hacer: robar sería puro teatro.
  const hayQueJugar = partida.manos.some((m) => {
    const v = valor(m.cartas);
    return !v.pasada && !(esBlackjack(m.cartas) && !m.separada);
  });

  if (hayQueJugar && !esBlackjack(partida.crupier)) {
    const jugado = juegaCrupier(partida.crupier, partida.zapato);
    partida.crupier = jugado.cartas;
    partida.zapato = jugado.zapato;
  }

  const resultados = partida.manos.map((m) => resolverMano(m, partida.crupier));
  const premio = resultados.reduce((s, r) => s + r.premio, 0);
  const apuesta = partida.manos.reduce((s, m) => s + m.apuesta, 0);

  await olvidarPartidaDe(usuario);
  const { saldo, neto } = await pagar({
    usuario,
    juego: 'blackjack',
    apuesta,
    premio,
    detalle:
      resultados.length === 1
        ? `${resultados[0].estado} · ${valor(partida.manos[0].cartas).total} contra ${valor(partida.crupier).total}`
        : `${resultados.length} manos: ${resultados.map((r) => r.estado).join(', ')}`,
  });

  return { partida, resultados, saldo, neto, apuesta, premio };
}

/** POST /api/casino/blackjack  body: { accion, apuesta } */
export async function POST(peticion) {
  const { sesion, corte } = await exigirCasino();
  if (corte) return corte;

  const usuario = sesion.usuario;
  const { accion, apuesta } = await peticion.json().catch(() => ({}));

  try {
    // Una lectura del mapa de partidas para toda la petición, y una escritura al final.
    const todas = await leerPartidas();
    const partida = todas[usuario] ?? null;

    if (accion === 'repartir') {
      // Idempotente: con una partida abierta la devuelve en vez de cobrar otra apuesta.
      if (partida) {
        return NextResponse.json(vista(partida, { saldo: await saldoDe(usuario), cierre: null }));
      }

      const validada = await validarApuesta(usuario, apuesta);
      if (validada.error) return no(validada.error, 400);

      const zapato = crearZapato();
      // Se reparte como en la mesa: jugador, crupier, jugador, crupier.
      const mias = [zapato.shift()];
      const suyas = [zapato.shift()];
      mias.push(zapato.shift());
      suyas.push(zapato.shift());

      const nueva = {
        zapato,
        crupier: suyas,
        activa: 0,
        manos: [
          {
            cartas: mias,
            apuesta: validada.apuesta,
            separada: false,
            deAs: false,
            doblada: false,
            plantada: false,
          },
        ],
      };

      const saldo = await cobrar(usuario, validada.apuesta);

      // El crupier mira la tapada si enseña as o figura; con blackjack la mano termina ahí.
      const crupierBJ = crupierAsoma(suyas) && esBlackjack(suyas);
      if (crupierBJ || esBlackjack(mias)) {
        const cierre = await cerrar(usuario, nueva, todas);
        return NextResponse.json(vista(cierre.partida, { saldo: cierre.saldo, cierre }));
      }

      await guardarPartidaDe(usuario, nueva);
      return NextResponse.json(vista(nueva, { saldo, cierre: null }));
    }

    if (!partida) return no('No tienes una mano en juego.', 400);

    let saldo = await saldoDe(usuario);
    const mano = partida.manos[partida.activa];
    const puede = acciones(mano, partida.manos.length, saldo);

    if (accion === 'pedir') {
      if (!puede.pedir) return no('No puedes pedir en esta mano.', 400);
      mano.cartas.push(partida.zapato.shift());
    } else if (accion === 'plantarse') {
      mano.plantada = true;
    } else if (accion === 'doblar') {
      if (!puede.doblar) return no('No puedes doblar en esta mano.', 400);
      saldo = await cobrar(usuario, mano.apuesta);
      mano.apuesta *= 2;
      mano.doblada = true;
      mano.cartas.push(partida.zapato.shift());
      mano.plantada = true;
    } else if (accion === 'separar') {
      if (!puede.separar) return no('No puedes separar esta mano.', 400);
      saldo = await cobrar(usuario, mano.apuesta);

      const deAs = mano.cartas[0].valor === 14;
      const base = { apuesta: mano.apuesta, separada: true, deAs, doblada: false, plantada: false };
      partida.manos.splice(
        partida.activa,
        1,
        { ...base, cartas: [mano.cartas[0]] },
        { ...base, cartas: [mano.cartas[1]] }
      );
    } else {
      return no('Acción desconocida.', 400);
    }

    if (avanzar(partida)) {
      const cierre = await cerrar(usuario, partida, todas);
      return NextResponse.json(vista(cierre.partida, { saldo: cierre.saldo, cierre }));
    }

    await guardarPartidaDe(usuario, partida);
    return NextResponse.json(vista(partida, { saldo, cierre: null }));
  } catch (e) {
    return no(`No se pudo jugar: ${e.message}`, 500);
  }
}
