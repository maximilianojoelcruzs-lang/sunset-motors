// Pedidos de tunning: la lista de piezas que hay que instalarle a un vehículo.
//
//   { id, creadoPor, creado, cerrado, piezas: [{ id, categoria, etiqueta, valor, hecha }] }
//
// Un pedido **no lleva patente**. Se abre, se trabaja y se cierra en el rato que dura el auto
// en el elevador; escribir la patente era un trámite antes de empezar y no servía para nada
// después. Los pedidos viejos que la tengan guardada no molestan: la pantalla la muestra si
// está y si no usa la hora en que se abrió.
//
// El pedido lo canta la tablet del juego y puede traer treinta líneas. Esto es la copia con
// la que se trabaja: se marca cada pieza al instalarla y así no hay que volver a la tablet
// a buscar por dónde iba uno.
//
// **Lo que se guarda de cada línea es la categoría y el número, no el nombre largo.** En el
// menú del juego se entra a «Parachoques» y se elige el 4: el nombre bonito del pedido no se
// usa para nada mientras se instala, y escribirlo entero para treinta piezas es lo que hacía
// que nadie usara una lista.

import { leer, guardar } from './almacen.js';
import { CATEGORIAS, ordenDe } from './tunning-categorias.js';

export const TUNNING = 'sunset:tunning';

export const MAX_PIEZAS = 60;
export const MAX_VALOR = 40;
const MAX_CERRADOS = 20;

/**
 * Ordena las piezas como el menú del juego, y dentro de cada categoría por número.
 *
 * Es lo que evita entrar y salir del mismo submenú: se baja una vez por sección y no se
 * vuelve atrás. Las hechas no se mueven de sitio — cambiar la lista bajo los ojos de alguien
 * que está trabajando es la forma más rápida de que instale la pieza equivocada.
 */
export const ordenar = (piezas) =>
  [...piezas].sort(
    (a, b) =>
      ordenDe(a.categoria) - ordenDe(b.categoria) ||
      String(a.valor).localeCompare(String(b.valor), 'es', { numeric: true })
  );

const conOrden = (pedido) => ({ ...pedido, piezas: ordenar(pedido.piezas ?? []) });

export async function listar() {
  const todos = await leer(TUNNING);
  return [...todos]
    .sort((a, b) => Number(a.cerrado) - Number(b.cerrado) || b.creado.localeCompare(a.creado))
    .map(conOrden);
}

export async function porId(id) {
  const pedido = (await leer(TUNNING)).find((p) => p.id === id);
  return pedido ? conOrden(pedido) : null;
}

/**
 * Abre un pedido, opcionalmente ya con todas sus piezas.
 *
 * Cargarlas acá y no con treinta llamadas seguidas es lo que hace que pegar un pedido de
 * treinta líneas sea una escritura y no treinta: contra Supabase cada una es una ida y vuelta
 * por la red, y encima cada colección se lee y reescribe entera.
 */
export async function crear(usuario, entradas = []) {
  const lista = await leer(TUNNING);

  const { piezas, error } = interpretar(entradas, 0);
  if (error) return { error };

  const pedido = {
    id: crypto.randomUUID(),
    creadoPor: usuario,
    creado: new Date().toISOString(),
    cerrado: false,
    piezas,
  };
  await guardar(TUNNING, [pedido, ...lista]);
  return { pedido: conOrden(pedido) };
}

/** Valida una línea. `categoria` es del catálogo, o `null` con `etiqueta` propia. */
function piezaDe({ categoria, etiqueta, valor }) {
  const delCatalogo = CATEGORIAS.find((c) => c.id === categoria);
  const nombre = delCatalogo ? null : String(etiqueta ?? '').trim().slice(0, 40);
  if (!delCatalogo && !nombre) return { error: 'Elige una categoría o escribe cuál es.' };

  const limpio = String(valor ?? '').trim().slice(0, MAX_VALOR);
  if (!limpio) return { error: `Falta el número de «${delCatalogo?.nombre ?? nombre}».` };

  return {
    pieza: {
      id: crypto.randomUUID(),
      categoria: delCatalogo ? delCatalogo.id : null,
      etiqueta: nombre,
      valor: limpio,
      hecha: false,
    },
  };
}

/** Valida un montón de líneas de golpe: o entran todas o no entra ninguna. */
function interpretar(entradas, yaHay) {
  const lote = Array.isArray(entradas) ? entradas : [entradas];
  if (yaHay + lote.length > MAX_PIEZAS) {
    return { error: `Un pedido no puede llevar más de ${MAX_PIEZAS} piezas.` };
  }

  const piezas = [];
  for (const entrada of lote) {
    const { pieza, error } = piezaDe(entrada ?? {});
    if (error) return { error };
    piezas.push(pieza);
  }
  return { piezas };
}

/** Añade una pieza o muchas. `entradas` es un objeto o un arreglo. */
export async function agregar(id, entradas) {
  const lista = await leer(TUNNING);
  const i = lista.findIndex((p) => p.id === id);
  if (i === -1) return { error: 'Ese pedido no existe.' };
  if (lista[i].cerrado) return { error: 'Ese pedido ya está cerrado.' };

  const { piezas, error } = interpretar(entradas, lista[i].piezas.length);
  if (error) return { error };
  if (!piezas.length) return { error: 'No hay nada que añadir.' };

  const copia = [...lista];
  copia[i] = { ...copia[i], piezas: [...copia[i].piezas, ...piezas] };
  await guardar(TUNNING, copia);
  return { pedido: conOrden(copia[i]) };
}

export async function quitar(id, piezaId) {
  return cambiar(id, (pedido) => ({
    ...pedido,
    piezas: pedido.piezas.filter((p) => p.id !== piezaId),
  }));
}

/** Marca o desmarca una pieza. Desmarcar existe porque uno se equivoca de fila. */
export async function marcar(id, piezaId, hecha) {
  return cambiar(id, (pedido) => ({
    ...pedido,
    piezas: pedido.piezas.map((p) => (p.id === piezaId ? { ...p, hecha: Boolean(hecha) } : p)),
  }));
}

export async function cerrar(id, cerrado = true) {
  return cambiar(
    id,
    (pedido) => ({ ...pedido, cerrado: Boolean(cerrado) }),
    { permiteCerrado: true }
  );
}

async function cambiar(id, hacer, { permiteCerrado = false } = {}) {
  const lista = await leer(TUNNING);
  const i = lista.findIndex((p) => p.id === id);
  if (i === -1) return { error: 'Ese pedido no existe.' };
  if (lista[i].cerrado && !permiteCerrado) return { error: 'Ese pedido ya está cerrado.' };

  const copia = [...lista];
  copia[i] = hacer(copia[i]);

  // Los cerrados se guardan un rato por si hay que consultarlos, pero no para siempre.
  const abiertos = copia.filter((p) => !p.cerrado);
  const cerrados = copia.filter((p) => p.cerrado).slice(0, MAX_CERRADOS);

  await guardar(TUNNING, [...abiertos, ...cerrados]);
  return { pedido: conOrden(copia[i]) };
}

export async function borrar(id, usuario, admin) {
  const lista = await leer(TUNNING);
  const pedido = lista.find((p) => p.id === id);
  if (!pedido) return { error: 'Ese pedido no existe.' };
  if (!admin && pedido.creadoPor !== usuario) return { error: 'No es tuyo.' };

  await guardar(TUNNING, lista.filter((p) => p.id !== id));
  return { ok: true };
}
