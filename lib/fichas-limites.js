// Límites de apuesta, aparte de lib/fichas.js porque los necesita el navegador y aquel
// arrastra lib/almacen.js, que usa node:fs.

/**
 * Las únicas fichas que existen en la sala. Se apuesta poniendo fichas, no escribiendo una
 * cifra: en una mesa de verdad no se puede apostar 501.
 */
export const FICHAS = [50, 100, 500, 1000, 5000];

export const APUESTA_MINIMA = FICHAS[0];
export const APUESTA_MAXIMA = 10000;
export const SALDO_INICIAL = 5000;

/** Una sola ficha, de las que existen. */
export const esFicha = (n) => FICHAS.includes(n);

/**
 * Una pila de fichas: cualquier suma que se pueda armar con las de arriba.
 *
 * Como la más chica divide a todas las demás, eso es exactamente «múltiplo de 50». Vale
 * para las mesas donde se apilan fichas en varios sitios —la ruleta y el surf—, donde el
 * total de un sitio no tiene por qué ser el valor de una ficha suelta.
 */
export const esPilaDeFichas = (n) =>
  Number.isInteger(n) && n >= FICHAS[0] && n % FICHAS[0] === 0;
