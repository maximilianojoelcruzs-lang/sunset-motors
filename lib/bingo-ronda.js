// La ronda de bingo en curso.
//
//   sunset:bingo   { ronda: { id, estado, abierta, cierraVenta, orden, cartones, ... },
//                    historial: [las últimas terminadas] }
//
// **La ronda avanza al leerla, no en un proceso de fondo** — esta app no tiene ninguno, igual
// que los turnos que se cierran solos. Como el orden de las bolas se sortea al abrir y el
// ritmo es fijo, en qué bola va la ronda es una **cuenta del reloj**, no un estado que haya
// que ir guardando: `bolasCantadas = (ahora − inicioCanto) / RITMO`. Da lo mismo si nadie
// mira la página durante diez minutos; al volver, la ronda está donde tiene que estar.
//
// `orden` no sale nunca entero al navegador: solo las bolas ya cantadas. Si viajara completo,
// cualquiera sabría con qué cartón va a ganar antes de comprarlo.

import { leer, guardar } from './almacen.js';
import { cobrar, pagar } from './fichas.js';
import {
  MAX_CARTONES,
  PRECIO_CARTON,
  RITMO_MS,
  VENTA_MS,
  crearCarton,
  repartir,
  resolver,
  sortearBolas,
} from './bingo.js';

export const BINGO = 'sunset:bingo';
const MAX_HISTORIAL = 8;

const leerTodo = () => leer(BINGO, { ronda: null, historial: [] });

/** Cuántas bolas se han cantado ya, según el reloj. */
export function bolasCantadas(ronda, ahora) {
  if (ronda.estado !== 'cantando') return 0;
  const pasado = ahora - Date.parse(ronda.cierraVenta);
  return Math.max(0, Math.min(ronda.orden.length, Math.floor(pasado / RITMO_MS) + 1));
}

/**
 * Pone la ronda al día y, si terminó, paga.
 *
 * Se llama desde cualquier lectura. Devuelve la ronda ya avanzada y lo que haya que guardar.
 */
async function alDia(datos, ahora) {
  let { ronda, historial = [] } = datos;
  if (!ronda) return { ronda: null, historial, cambio: false };

  let cambio = false;

  if (ronda.estado === 'vendiendo' && ahora >= Date.parse(ronda.cierraVenta)) {
    // Sin cartones no hay ronda que cantar: se borra y la siguiente compra abre otra.
    if (!ronda.cartones.length) return { ronda: null, historial, cambio: true };
    ronda = { ...ronda, estado: 'cantando' };
    cambio = true;
  }

  if (ronda.estado === 'cantando') {
    const resultado = resolver(ronda.cartones, ronda.orden);
    if (bolasCantadas(ronda, ahora) > resultado.ultimaBola) {
      const reparto = repartir(ronda.cartones, resultado);

      // **Acá no se paga.** Solo se anota quién ganó y cuánto; el abono va aparte, en
      // `cobrarPremio()`. Ver el comentario de esa función: pagar en este punto hacía que
      // dos pestañas mirando a la vez cerraran la ronda las dos y el ganador cobrara doble.
      const terminada = {
        ...ronda,
        estado: 'terminada',
        termino: new Date(ahora).toISOString(),
        cobrados: [],
        resultado: {
          ultimaBola: resultado.ultimaBola,
          linea: resultado.linea,
          bingo: resultado.bingo,
          ganadoresLinea: resultado.ganadoresLinea.map((c) => c.usuario),
          ganadoresBingo: resultado.ganadoresBingo.map((c) => c.usuario),
          bote: reparto.bote,
          premios: [...reparto.premios.entries()].map(([usuario, cuanto]) => ({
            usuario,
            cuanto,
          })),
        },
      };
      return {
        ronda: null,
        historial: [terminada, ...historial].slice(0, MAX_HISTORIAL),
        cambio: true,
      };
    }
  }

  return { ronda, historial, cambio };
}

/**
 * Abona a **una sola persona** lo que haya ganado en las rondas que ya terminaron.
 *
 * Cada quien cobra lo suyo y nadie cobra por otro. Es lo que evita el problema de verdad:
 * antes, cerrar la ronda pagaba a todos los ganadores, y como la ronda se cierra "al leer",
 * dos pestañas mirando a la vez la cerraban las dos y el premio se pagaba dos veces. Medido:
 * un ganador de 1.900 se llevó 3.800.
 *
 * Ahora, para que se duplique haría falta que **la misma persona** tenga dos pestañas
 * consultando en el mismo instante, y aun así hay que pasar el `cobrados`, que se escribe
 * antes de mover ninguna ficha. El almacén no tiene forma de comparar-y-escribir, así que
 * esto es lo más cerca que se puede estar sin cambiarlo por una tabla de verdad.
 */
async function cobrarPremio(usuario, historial) {
  const pendientes = historial.filter(
    (h) =>
      h.resultado?.premios?.some((p) => p.usuario === usuario) &&
      // Sin `cobrados` es una ronda de antes de este cambio, que ya se pagó al cerrarse.
      // Tratarla como pendiente la pagaría por segunda vez a quien vuelva a entrar.
      Array.isArray(h.cobrados) &&
      !h.cobrados.includes(usuario)
  );
  if (!pendientes.length) return { historial, cambio: false };

  // Se marca como cobrado **antes** de mover las fichas. Al revés, un fallo entre una cosa
  // y la otra pagaría dos veces a la siguiente lectura.
  const marcado = historial.map((h) =>
    pendientes.some((p) => p.id === h.id)
      ? { ...h, cobrados: [...(h.cobrados ?? []), usuario] }
      : h
  );

  return { historial: marcado, cambio: true, pendientes };
}

/**
 * La ronda tal como está ahora, ya avanzada, y de paso le abona a `usuario` lo que haya
 * ganado y no haya cobrado todavía.
 *
 * Quien no vuelva a abrir el bingo cobra la próxima vez que entre: el premio queda anotado
 * en el historial hasta que aparezca. No se pierde.
 */
export async function estado(usuario = null, ahora = Date.now()) {
  const datos = await leerTodo();
  const puesto = await alDia(datos, ahora);

  const cobro = usuario
    ? await cobrarPremio(usuario, puesto.historial)
    : { historial: puesto.historial, cambio: false };

  if (puesto.cambio || cobro.cambio) {
    await guardar(BINGO, { ronda: puesto.ronda, historial: cobro.historial });
  }

  // Las fichas se mueven **después** de que la marca de cobrado quedó guardada.
  for (const ronda of cobro.pendientes ?? []) {
    const premio = ronda.resultado.premios.find((p) => p.usuario === usuario);
    await pagar({
      usuario,
      juego: 'bingo',
      apuesta: 0, // ya se cobró al comprar el cartón
      premio: premio.cuanto,
      detalle: `Bingo · ronda de ${ronda.cartones.length} cartones`,
    });
  }

  return { ronda: puesto.ronda, historial: cobro.historial };
}

/**
 * Compra cartones. Abre la ronda si no había ninguna.
 *
 * Solo se venden mientras la ronda está `vendiendo`: entrar a mitad de partida con un cartón
 * nuevo sería comprar sabiendo qué bolas ya salieron.
 */
export async function comprar(usuario, cuantos, ahora = Date.now()) {
  const n = Math.round(Number(cuantos));
  if (!Number.isInteger(n) || n < 1 || n > MAX_CARTONES) {
    return { error: `Se compran de 1 a ${MAX_CARTONES} cartones.` };
  }

  const datos = await leerTodo();
  const puesto = await alDia(datos, ahora);
  let ronda = puesto.ronda;

  if (ronda && ronda.estado !== 'vendiendo') {
    return { error: 'Esta ronda ya empezó. Espera a la siguiente.' };
  }

  if (!ronda) {
    ronda = {
      id: crypto.randomUUID(),
      estado: 'vendiendo',
      abierta: new Date(ahora).toISOString(),
      cierraVenta: new Date(ahora + VENTA_MS).toISOString(),
      orden: sortearBolas(),
      cartones: [],
    };
  }

  const mios = ronda.cartones.filter((c) => c.usuario === usuario).length;
  if (mios + n > MAX_CARTONES) {
    return { error: `Como mucho ${MAX_CARTONES} cartones por persona y ronda.` };
  }

  const nuevos = Array.from({ length: n }, () => ({
    id: crypto.randomUUID(),
    usuario,
    numeros: crearCarton(),
  }));

  const conCartones = { ...ronda, cartones: [...ronda.cartones, ...nuevos] };
  await guardar(BINGO, { ronda: conCartones, historial: puesto.historial });

  const saldo = await cobrar(usuario, n * PRECIO_CARTON);
  return { ronda: conCartones, saldo, comprados: nuevos.length };
}
