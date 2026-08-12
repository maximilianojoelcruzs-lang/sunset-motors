// Duelo de cartas: una carta para el Rojo, una para el Azul, gana la más alta.
//
// Es el Dragon Tiger de los casinos asiáticos, con los colores de la sala. Una sola carta por
// bando, nada que decidir después de apostar: es el juego más rápido de la mesa y por eso el
// que más se juega en Asia.
//
//   · El as vale 1 y es la carta más baja; el rey, 13. El palo no importa.
//   · Se apuesta a Rojo, a Azul o a Empate.
//   · Rojo y Azul pagan 1 a 1. El Empate paga 11 a 1.
//   · **Si sale empate, quien apostó a un bando pierde la mitad.** No es un castigo suelto:
//     es de ahí de donde sale la ventaja de la casa en este juego. Sin esa regla, Rojo y Azul
//     serían una apuesta justa y la casa no ganaría nada.
//
// Con seis mazos: el empate sale el 7,40% de las veces, así que
//
//   Rojo/Azul  = 0,4630 − 0,5×0,0740 − 0,4630 = −3,70%   ventaja de la casa 3,70%
//   Empate     = 0,0740×11 − 0,9260          = −11,25%   ventaja de la casa 11,25%
//
// El 3,70% del bando es de los buenos de la sala; el del empate es malo y se muestra en
// pantalla tal cual, como en los dados. Esconderlo sería menos honesto que enseñarlo.

import { crearMazo } from './poker.js';

export const MAZOS = 6;
export const PAGA_EMPATE = 11;

export const BANDOS = [
  { id: 'rojo', nombre: 'Rojo', color: '#c02334' },
  { id: 'azul', nombre: 'Azul', color: '#2f6bd8' },
];

export const APUESTAS = {
  rojo: { etiqueta: 'Rojo', paga: 1, ventaja: 0.037 },
  azul: { etiqueta: 'Azul', paga: 1, ventaja: 0.037 },
  empate: { etiqueta: 'Empate', paga: PAGA_EMPATE, ventaja: 0.1125 },
};

/**
 * Lo que vale una carta en este juego. El as es **la más baja**, al revés que en el póker,
 * que es como se juega el Dragon Tiger de verdad.
 */
export const rango = (carta) => (carta.valor === 14 ? 1 : carta.valor);

export const NOMBRES = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' };
export const nombreRango = (n) => NOMBRES[n] ?? String(n);

/** El mazo, una sola vez. El zapato son seis copias de este, así que basta con el módulo. */
const MAZO = crearMazo();
export const CARTAS = MAZO.length * MAZOS; // 312

/** Entero de 0 a n-1 sin sesgo: se descarta el sobrante en vez de repartirlo. */
function alAzar(n) {
  const tope = Math.floor(0x100000000 / n) * n;
  const b = new Uint32Array(1);
  let v;
  do {
    crypto.getRandomValues(b);
    v = b[0];
  } while (v >= tope);
  return v % n;
}

/**
 * Reparte el duelo: una carta a cada bando.
 *
 * Se sacan **dos posiciones del zapato**, no se baraja: barajar 312 cartas para usar dos es
 * el mismo resultado y trescientas veces más trabajo. La segunda posición se elige entre las
 * 311 restantes y se corre una si cae sobre la primera — así ninguna carta sale dos veces y
 * cada par tiene la misma probabilidad que en una mesa de seis mazos.
 */
export function repartir() {
  const a = alAzar(CARTAS);
  let b = alAzar(CARTAS - 1);
  if (b >= a) b += 1;

  const rojo = MAZO[a % MAZO.length];
  const azul = MAZO[b % MAZO.length];
  const alto = rango(rojo);
  const bajo = rango(azul);

  return {
    rojo,
    azul,
    ganador: alto === bajo ? 'empate' : alto > bajo ? 'rojo' : 'azul',
  };
}

/**
 * Resuelve una apuesta contra el resultado.
 *
 * `premio` incluye lo apostado, como en toda la sala: perder devuelve 0, y el bando que cae
 * en empate devuelve la mitad — que es exactamente perder la mitad.
 */
export function resolverApuesta({ id, monto, ganador }) {
  const def = APUESTAS[id];
  if (!def) return { error: 'Esa apuesta no existe en la mesa.' };

  if (id === 'empate') {
    const gano = ganador === 'empate';
    return {
      id,
      etiqueta: def.etiqueta,
      monto,
      gano,
      premio: gano ? monto * (PAGA_EMPATE + 1) : 0,
    };
  }

  if (ganador === 'empate') {
    // Ni gana ni pierde del todo: se lleva la mitad de vuelta.
    return {
      id,
      etiqueta: def.etiqueta,
      monto,
      gano: false,
      mitad: true,
      premio: Math.round(monto / 2),
    };
  }

  const gano = ganador === id;
  return { id, etiqueta: def.etiqueta, monto, gano, premio: gano ? monto * 2 : 0 };
}
