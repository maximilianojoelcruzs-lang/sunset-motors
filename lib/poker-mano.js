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

import { cambiar, leer } from './almacen.js';

export const MANOS = 'sunset:poker-manos';

export async function manoPendiente(usuario) {
  const todas = await leer(MANOS, {});
  return todas[usuario] ?? null;
}

export async function guardarMano(usuario, datos) {
  const mano = { ...datos, cuando: new Date().toISOString() };
  // Solo la mano de esta persona, mezclada contra lo que haya: escribiendo el mapa entero, dos
  // personas jugando a la vez se borraban la mano una a la otra.
  await cambiar(MANOS, (todas) => ({ lista: { ...todas, [usuario]: mano }, valor: { mano } }), {
    porDefecto: {},
  });
}

export async function borrarMano(usuario) {
  await cambiar(
    MANOS,
    (todas) => {
      if (!(usuario in todas)) return { lista: null, valor: { ok: true } };
      const { [usuario]: _fuera, ...resto } = todas;
      return { lista: resto, valor: { ok: true } };
    },
    { porDefecto: {} }
  );
}
