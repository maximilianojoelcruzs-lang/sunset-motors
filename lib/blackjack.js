// Blackjack. Las reglas son las de una mesa de verdad, y están elegidas una por una:
//
//   · Seis mazos, barajados de nuevo en cada mano. Así no hay cuenta de cartas que valga.
//   · El crupier se planta en 17, también en el 17 blando. Es la regla buena para el jugador.
//   · El blackjack paga 3 a 2. Las mesas que pagan 6 a 5 le suben la ventaja a la casa más
//     del doble por este solo cambio; acá paga lo que corresponde.
//   · Se doblan dos cartas cualesquiera, y también después de separar.
//   · Se separa hasta tres veces (cuatro manos). Los ases separados reciben **una** carta y
//     no se vuelven a separar, como en cualquier casino.
//   · El crupier mira su carta tapada cuando enseña as o figura, y si tiene blackjack la mano
//     termina ahí.
//   · **No hay seguro.** No es un olvido: es la peor apuesta de la mesa, con una ventaja para
//     la casa cercana al 7%, y ponerla sería empeorar el juego a propósito.
//
// Con estas reglas y jugando bien, a la casa le queda alrededor del **0,5%**: es de lejos el
// mejor juego de la sala. Ahora, el margen depende de cómo se juegue — al revés que la ruleta,
// acá las decisiones cambian el resultado.
//
// Módulo puro: se puede importar desde el navegador para pintar la mesa y probar sin nada
// levantado. El zapato y la carta tapada los guarda el servidor, no este archivo.

import { barajar, crearMazo } from './poker.js';

export const MAZOS = 6;
export const MAX_MANOS = 4;
export const PAGA_BLACKJACK = 1.5;

export const REGLAS = [
  '6 mazos, barajados en cada mano',
  'El crupier se planta en 17, incluso blando',
  'Blackjack paga 3 a 2',
  'Se doblan dos cartas cualesquiera',
  'Se separa hasta 4 manos · ases, una carta',
  'Sin seguro: es la peor apuesta de la mesa',
];

export function crearZapato() {
  const cartas = [];
  for (let i = 0; i < MAZOS; i += 1) cartas.push(...crearMazo());
  return barajar(cartas);
}

/** Cuánto vale una carta en blackjack: las figuras 10 y el as 11 (se ablanda si hace falta). */
export function valorCarta(carta) {
  if (carta.valor >= 11 && carta.valor <= 13) return 10;
  if (carta.valor === 14) return 11;
  return carta.valor;
}

/**
 * El total de una mano. `blanda` significa que todavía hay un as contando 11 — importa,
 * porque una mano blanda no se puede pasar pidiendo una carta.
 */
export function valor(cartas) {
  let total = 0;
  let ases = 0;
  for (const c of cartas) {
    total += valorCarta(c);
    if (c.valor === 14) ases += 1;
  }
  while (total > 21 && ases > 0) {
    total -= 10;
    ases -= 1;
  }
  return { total, blanda: ases > 0, pasada: total > 21 };
}

/** Blackjack de verdad: as y diez en las dos primeras cartas. Un 21 armado no cuenta. */
export const esBlackjack = (cartas) => cartas.length === 2 && valor(cartas).total === 21;

/** Si el crupier enseña as o figura, mira la tapada antes de que nadie juegue. */
export const crupierAsoma = (cartas) => valorCarta(cartas[0]) >= 10;

/** El crupier pide hasta 17 y se planta ahí, blando o no. */
export function juegaCrupier(cartas, zapato) {
  const mano = cartas.slice();
  const resto = zapato.slice();
  while (valor(mano).total < 17) mano.push(resto.shift());
  return { cartas: mano, zapato: resto };
}

/** Qué se puede hacer con la mano que toca. */
export function acciones(mano, cuantasManos, saldo) {
  const v = valor(mano.cartas);
  const dosCartas = mano.cartas.length === 2;
  const parejo = dosCartas && valorCarta(mano.cartas[0]) === valorCarta(mano.cartas[1]);

  return {
    // Un as separado recibe una carta y se planta: no se pide más.
    pedir: !mano.deAs && !v.pasada && v.total < 21,
    plantarse: true,
    doblar: dosCartas && !mano.deAs && saldo >= mano.apuesta,
    separar: dosCartas && parejo && cuantasManos < MAX_MANOS && !mano.deAs && saldo >= mano.apuesta,
  };
}

/**
 * Lo único que ve el navegador. Mientras se juega salen la carta destapada del crupier y las
 * del jugador, y nada más: **la tapada y el zapato se quedan en el servidor**. Vive acá y no
 * en el route handler porque la página también la usa, para retomar una partida a medias.
 */
export function vista(partida, { saldo, cierre }) {
  const acabo = Boolean(cierre);

  return {
    fase: acabo ? 'fin' : 'jugando',
    crupier: {
      cartas: acabo ? partida.crupier : [partida.crupier[0]],
      total: acabo ? valor(partida.crupier).total : valorCarta(partida.crupier[0]),
      tapada: !acabo,
      blackjack: acabo && esBlackjack(partida.crupier),
      pasada: acabo && valor(partida.crupier).pasada,
    },
    manos: partida.manos.map((m, i) => ({
      cartas: m.cartas,
      ...valor(m.cartas),
      apuesta: m.apuesta,
      doblada: Boolean(m.doblada),
      deAs: Boolean(m.deAs),
      blackjack: esBlackjack(m.cartas) && !m.separada,
      estado: cierre ? cierre.resultados[i].estado : null,
      premio: cierre ? cierre.resultados[i].premio : null,
    })),
    activa: acabo ? null : partida.activa,
    puede: acabo
      ? { pedir: false, plantarse: false, doblar: false, separar: false }
      : acciones(partida.manos[partida.activa], partida.manos.length, saldo),
    saldo,
    apuestaTotal: acabo ? cierre.apuesta : partida.manos.reduce((s, m) => s + m.apuesta, 0),
    premioTotal: acabo ? cierre.premio : null,
    neto: acabo ? cierre.neto : null,
    gano: acabo ? cierre.neto > 0 : null,
  };
}

/**
 * Cuánto devuelve una mano ya cerrada. Como en el resto del casino, el premio **incluye**
 * lo apostado: perder devuelve 0, empatar devuelve la apuesta, ganar el doble.
 */
export function resolverMano(mano, crupier) {
  const mia = valor(mano.cartas);
  const suya = valor(crupier);
  const miBlackjack = esBlackjack(mano.cartas) && !mano.separada;
  const suBlackjack = esBlackjack(crupier);

  if (mia.pasada) return { estado: 'Te pasaste', premio: 0 };

  if (miBlackjack && suBlackjack) return { estado: 'Empate con blackjack', premio: mano.apuesta };
  if (miBlackjack) {
    return { estado: 'Blackjack', premio: Math.round(mano.apuesta * (1 + PAGA_BLACKJACK)) };
  }
  if (suBlackjack) return { estado: 'Blackjack del crupier', premio: 0 };

  if (suya.pasada) return { estado: 'Se pasó el crupier', premio: mano.apuesta * 2 };
  if (mia.total > suya.total) return { estado: 'Ganaste', premio: mano.apuesta * 2 };
  if (mia.total < suya.total) return { estado: 'Gana el crupier', premio: 0 };
  return { estado: 'Empate', premio: mano.apuesta };
}
