// Los premios del top de wager, aparte porque la pantalla del casino los necesita en el
// navegador y lib/wager.js arrastra lib/almacen.js (`node:fs`). Mismo caso que fichas-limites.js.

/**
 * Lo que se lleva cada puesto al cerrar el ciclo, **en plata del juego**.
 *
 * No son fichas del casino: al cerrar, cada puesto recibe una solicitud de devolución con este
 * monto y el encargado se la paga dentro del juego.
 *
 * El orden **es** el puesto: el primero de la lista es el primer lugar. Añadir un cuarto premio
 * es añadir un número acá y nada más — la pantalla y el cierre leen la longitud de esta lista.
 */
export const PREMIOS = [30000, 20000, 5000];

/**
 * Wager es **lo apostado**, no lo ganado ni lo perdido.
 *
 * Es a propósito y es lo que hace justa la tabla: quien apuesta 100 diez veces suma 1.000 de
 * wager aunque acabe igual que empezó. Premiar la ganancia neta premiaría la suerte, y encima
 * dejaría el primer puesto fijo en quien tuvo una racha buena.
 */
export const QUE_ES_WAGER =
  'La suma de todo lo que has apostado, ganes o pierdas. Una apuesta de 100 suma 100 al wager ' +
  'aunque la ganes.';
