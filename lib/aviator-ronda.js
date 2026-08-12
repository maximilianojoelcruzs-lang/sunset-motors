// El vuelo en curso.
//
//   sunset:aviator   { usuario: { apuesta, choque, inicio, auto } }
//
// **`choque` no sale nunca de acá mientras el avión vuela.** Es todo el juego: si el navegador
// supiera dónde se cae, se retiraría siempre un pelo antes. Se cuenta recién al cerrar.
//
// Aparte de `lib/aviator.js` porque ese lo importa la mesa desde el navegador para dibujar la
// curva, y este toca el almacén.

import { leer, guardar } from './almacen.js';

export const RONDAS = 'sunset:aviator';

export async function rondaDe(usuario) {
  const todas = await leer(RONDAS, {});
  return todas[usuario] ?? null;
}

export async function guardarRonda(usuario, ronda) {
  const todas = await leer(RONDAS, {});
  await guardar(RONDAS, { ...todas, [usuario]: ronda });
}

export async function borrarRonda(usuario) {
  const todas = await leer(RONDAS, {});
  if (!(usuario in todas)) return;
  const { [usuario]: _fuera, ...resto } = todas;
  await guardar(RONDAS, resto);
}
