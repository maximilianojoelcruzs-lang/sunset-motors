// La mano de póker a medio jugar.
//
//   sunset:poker-manos   { usuario: { mano, mazo, apuesta, cuando } }
//
// El póker se juega en dos pasos y **el mazo se guarda en el servidor entre uno y otro**. Si
// el resto del mazo viajara al navegador, quien mira la respuesta vería las cartas que vienen
// antes de elegir cuáles se queda, que es exactamente lo que el juego no puede permitir.
//
// Va aparte de `lib/poker.js` porque ese módulo lo importa la mesa desde el navegador, y este
// toca el almacén: juntarlos arrastraría `node:fs` al bundle del cliente y rompería el build.

import { leer, guardar } from './almacen.js';

export const MANOS = 'sunset:poker-manos';

export async function manoPendiente(usuario) {
  const todas = await leer(MANOS, {});
  return todas[usuario] ?? null;
}

export async function guardarMano(usuario, datos) {
  const todas = await leer(MANOS, {});
  await guardar(MANOS, { ...todas, [usuario]: { ...datos, cuando: new Date().toISOString() } });
}

export async function borrarMano(usuario) {
  const todas = await leer(MANOS, {});
  if (!(usuario in todas)) return;
  const { [usuario]: _fuera, ...resto } = todas;
  await guardar(MANOS, resto);
}
