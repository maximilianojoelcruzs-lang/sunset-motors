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

import { leer, guardar } from './almacen.js';

export const PARTIDAS = 'sunset:blackjack';

export async function partidaDe(usuario) {
  const todas = await leer(PARTIDAS, {});
  return todas[usuario] ?? null;
}

export async function guardarPartida(usuario, partida) {
  const todas = await leer(PARTIDAS, {});
  await guardar(PARTIDAS, {
    ...todas,
    [usuario]: { ...partida, cuando: new Date().toISOString() },
  });
}

export async function borrarPartida(usuario) {
  const todas = await leer(PARTIDAS, {});
  if (!(usuario in todas)) return;
  const { [usuario]: _fuera, ...resto } = todas;
  await guardar(PARTIDAS, resto);
}
