// La partida de mines a medio jugar.
//
//   sunset:mines   { usuario: { apuesta, minas, sembradas, destapadas, cuando } }
//
// **`sembradas` no sale nunca de acá mientras se juega.** Es todo el juego: si el navegador
// supiera dónde están las minas, se destaparía siempre alrededor. Se cuentan al cerrar.
//
// Aparte de `lib/mines.js` porque ese lo importa la pantalla para dibujar la escalera de
// pagos, y este toca el almacén. Se lee y se escribe una vez por petición, como el blackjack.

import { leer, guardar } from './almacen.js';

export const PARTIDAS = 'sunset:mines';

export const leerPartidas = () => leer(PARTIDAS, {});
export const escribirPartidas = (todas) => guardar(PARTIDAS, todas);

export async function partidaDe(usuario) {
  return (await leerPartidas())[usuario] ?? null;
}

export const conPartida = (todas, usuario, partida) => ({
  ...todas,
  [usuario]: { ...partida, cuando: new Date().toISOString() },
});

export const sinPartida = (todas, usuario) => {
  const { [usuario]: _fuera, ...resto } = todas;
  return resto;
};
