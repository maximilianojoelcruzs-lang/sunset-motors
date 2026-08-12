// Fichas del casino y registro de jugadas.
//
//   sunset:fichas   { saldos: { usuario: entero } }
//   sunset:jugadas  [{ id, usuario, juego, apuesta, premio, neto, detalle, cuando }]
//
// Las fichas son de rol: no se compran, no valen dinero y no se convierten en dinero. El
// administrador las reparte y punto.
//
// El saldo vive SOLO en el servidor. Nunca se acepta un saldo que venga del navegador, ni
// se descuenta en el cliente: si el descuento se hiciera allá, bastaría con no llamar a la
// API para jugar gratis.

import { leer, guardar } from './almacen.js';
import {
  APUESTA_MAXIMA,
  APUESTA_MINIMA,
  FICHAS as VALORES,
  SALDO_INICIAL,
  esFicha,
  esPilaDeFichas,
} from './fichas-limites.js';

export const FICHAS = 'sunset:fichas';
export const JUGADAS = 'sunset:jugadas';

export { APUESTA_MAXIMA, APUESTA_MINIMA, SALDO_INICIAL, VALORES, esFicha, esPilaDeFichas };
export const MAX_JUGADAS = 500;

export async function saldoDe(usuario) {
  const { saldos = {} } = await leer(FICHAS, {});
  return saldos[usuario] ?? SALDO_INICIAL;
}

export async function todosLosSaldos() {
  const { saldos = {} } = await leer(FICHAS, {});
  return saldos;
}

async function ponerSaldo(usuario, valor) {
  const actual = await leer(FICHAS, {});
  const saldos = { ...(actual.saldos ?? {}), [usuario]: Math.max(0, Math.round(valor)) };
  await guardar(FICHAS, { saldos });
}

/**
 * Suma (o resta) al saldo leyendo y escribiendo **una sola vez**.
 *
 * `saldoDe()` seguido de `ponerSaldo()` son dos lecturas y una escritura. Contra Supabase
 * cada una es un viaje de ida y vuelta, y una mano de blackjack encadena varias: eso era la
 * mitad de la lentitud que se sentía en esa mesa.
 */
async function moverSaldo(usuario, delta) {
  const actual = await leer(FICHAS, {});
  const antes = actual.saldos?.[usuario] ?? SALDO_INICIAL;
  const despues = Math.max(0, Math.round(antes + delta));
  await guardar(FICHAS, { saldos: { ...(actual.saldos ?? {}), [usuario]: despues } });
  return despues;
}

/** Recarga o descuento hecho por el administrador. */
export async function ajustarSaldo(usuario, delta, porQuien) {
  const n = Math.round(Number(delta));
  if (!Number.isFinite(n) || n === 0) return { error: 'Pon una cantidad distinta de cero.' };

  const antes = await saldoDe(usuario);
  const despues = Math.max(0, antes + n);
  await ponerSaldo(usuario, despues);
  await anotar({
    usuario,
    juego: 'ajuste',
    apuesta: 0,
    premio: 0,
    neto: despues - antes,
    detalle: `${n > 0 ? 'Recarga' : 'Descuento'} de ${porQuien}`,
  });
  return { saldo: despues };
}

/** Guarda una jugada en el registro. Se conservan las más recientes. */
export async function anotar(jugada) {
  const lista = await leer(JUGADAS, []);
  const fila = {
    id: crypto.randomUUID(),
    cuando: new Date().toISOString(),
    ...jugada,
  };
  await guardar(JUGADAS, [fila, ...lista].slice(0, MAX_JUGADAS));
  return fila;
}

export async function jugadasDe(usuario, cuantas = 30) {
  const lista = await leer(JUGADAS, []);
  return (usuario ? lista.filter((j) => j.usuario === usuario) : lista).slice(0, cuantas);
}

/**
 * Descuenta la apuesta, aplica el premio y deja constancia. Todo junto, porque un premio
 * sin su descuento —o al revés— deja el saldo mintiendo.
 *
 * `premio` es lo que devuelve la mesa: 0 si perdió, y si ganó incluye la apuesta. Así una
 * apuesta de 100 a rojo que gana devuelve 200, y el neto es +100.
 */
export async function resolver({ usuario, juego, apuesta, premio, detalle }) {
  const saldo = await moverSaldo(usuario, premio - apuesta);
  await anotar({ usuario, juego, apuesta, premio, neto: premio - apuesta, detalle });
  return { saldo, neto: premio - apuesta };
}

/**
 * Cobra la apuesta sin cerrar la jugada. Para las mesas de dos pasos —el póker reparte,
 * espera a que la persona elija, y recién ahí se sabe cuánto paga.
 */
export async function cobrar(usuario, apuesta) {
  return moverSaldo(usuario, -apuesta);
}

/** Cierra una jugada ya cobrada: paga el premio y la deja anotada una sola vez. */
export async function pagar({ usuario, juego, apuesta, premio, detalle }) {
  const saldo = await moverSaldo(usuario, premio);
  await anotar({ usuario, juego, apuesta, premio, neto: premio - apuesta, detalle });
  return { saldo, neto: premio - apuesta };
}

/**
 * Comprueba que la apuesta sea válida y que alcance el saldo.
 *
 * **Tiene que ser una ficha de las que existen.** En pantalla no se puede escribir otra cosa,
 * pero eso es solo la pantalla: sin este chequeo, cualquiera manda 501 —o 3— por la API y se
 * salta la mesa. Las mesas donde se apilan fichas en varios sitios validan aparte, con
 * `esPilaDeFichas()`.
 */
export async function validarApuesta(usuario, apuesta) {
  const n = Math.round(Number(apuesta));
  if (!Number.isFinite(n) || n < APUESTA_MINIMA) {
    return { error: `La apuesta mínima es ${APUESTA_MINIMA} fichas.` };
  }
  if (n > APUESTA_MAXIMA) {
    return { error: `La apuesta máxima es ${APUESTA_MAXIMA} fichas.` };
  }
  if (!esFicha(n)) {
    return { error: `Solo se puede apostar con fichas: ${VALORES.join(', ')}.` };
  }

  const saldo = await saldoDe(usuario);
  if (n > saldo) return { error: 'No te alcanzan las fichas.' };

  return { apuesta: n, saldo };
}
