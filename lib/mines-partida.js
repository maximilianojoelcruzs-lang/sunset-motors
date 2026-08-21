// La partida de mines a medio jugar.
//
//   sunset:mines   { usuario: { apuesta, minas, sembradas, destapadas, cuando } }
//
// **`sembradas` no sale nunca de acá mientras se juega.** Es todo el juego: si el navegador
// supiera dónde están las minas, se destaparía siempre alrededor. Se cuentan al cerrar.
//
// Aparte de `lib/mines.js` porque ese lo importa la pantalla para dibujar la escalera de
// pagos, y este toca el almacén. Se lee y se escribe una vez por petición, como el blackjack.

import { leer, modificar } from './almacen.js';

export const PARTIDAS = 'sunset:mines';

export const leerPartidas = () => leer(PARTIDAS, {});

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

/**
 * Guarda **solo la partida de esta persona**, sobre lo que haya en el almacén en ese momento.
 *
 * Antes se escribía el mapa entero tal como se había leído, así que dos personas jugando a la
 * vez se borraban la partida una a la otra: la segunda escritura devolvía el mapa sin la mano
 * de la primera, y esa mano —ya cobrada— desaparecía. Con `modificar` la mezcla se hace contra
 * la versión de verdad, y sigue siendo una lectura y una escritura por petición.
 */
export const guardarPartidaDe = (usuario, partida) =>
  modificar(
    PARTIDAS,
    (todas) => ({ lista: conPartida(todas, usuario, partida), hecho: true }),
    undefined,
    { porDefecto: {} }
  );

/** Cierra la partida de esta persona sin tocar las de los demás. */
export const olvidarPartidaDe = (usuario) =>
  modificar(
    PARTIDAS,
    (todas) => (usuario in todas ? { lista: sinPartida(todas, usuario), hecho: true } : null),
    undefined,
    { porDefecto: {} }
  );
