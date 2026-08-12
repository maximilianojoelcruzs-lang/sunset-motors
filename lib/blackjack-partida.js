// La partida de blackjack a medio jugar.
//
//   sunset:blackjack   { usuario: { apuesta, zapato, crupier, manos, activa, cuando } }
//
// Igual que en el póker: **el zapato y la carta tapada del crupier se quedan en el servidor**.
// Si viajaran al navegador, quien mire la respuesta sabría qué carta viene antes de decidir si
// pide, que es todo el juego.
//
// Aparte de `lib/blackjack.js` porque ese lo importa la mesa desde el navegador y este toca el
// almacén: juntarlos arrastraría `node:fs` al bundle del cliente.
//
// La colección entera se lee y se escribe **una sola vez por petición**. Guardar con un
// `leer` + `guardar` por dentro parece cómodo, pero contra Supabase cada uno es un viaje de
// ida y vuelta, y una mano de blackjack encadena varios: ahí se iba la lentitud de la mesa.

import { leer, guardar } from './almacen.js';

export const PARTIDAS = 'sunset:blackjack';

export const leerPartidas = () => leer(PARTIDAS, {});
export const escribirPartidas = (todas) => guardar(PARTIDAS, todas);

export async function partidaDe(usuario) {
  return (await leerPartidas())[usuario] ?? null;
}

/** Deja la partida en el mapa que ya se leyó, sin volver a consultarlo. */
export const conPartida = (todas, usuario, partida) => ({
  ...todas,
  [usuario]: { ...partida, cuando: new Date().toISOString() },
});

export const sinPartida = (todas, usuario) => {
  const { [usuario]: _fuera, ...resto } = todas;
  return resto;
};
