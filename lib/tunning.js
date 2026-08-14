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
import { CATEGORIAS, ordenar } from './tunning-categorias.js';

export { ordenar };

export const TUNNING = 'sunset:tunning';

export const MAX_PIEZAS = 60;
export const MAX_VALOR = 40;
const MAX_CERRADOS = 20;

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

  // Una categoría, una fila: si la lista pegada trae «Llantas 12» y «Rines 12», es la misma.
  const porClave = new Map(piezas.map((p) => [claveDe(p), p]));

  const pedido = {
    id: crypto.randomUUID(),
    creadoPor: usuario,
    creado: new Date().toISOString(),
    cerrado: false,
    piezas: [...porClave.values()],
  };
  await guardar(TUNNING, [pedido, ...lista]);
  return { pedido: conOrden(pedido) };
}

// Un identificador propuesto por el navegador solo se acepta si tiene forma de UUID y no está
// usado. Sirve para que la fila que la pantalla ya pintó y la que guarda el servidor sean la
// misma: si el servidor inventara otro, marcar esa pieza antes de la siguiente lectura no
// encontraría nada y no haría nada, en silencio.
const idPropuesto = (id, usados) =>
  typeof id === 'string' && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id) && !usados.has(id)
    ? id
    : crypto.randomUUID();

/** Valida una línea. `categoria` es del catálogo, o `null` con `etiqueta` propia. */
function piezaDe({ id, categoria, etiqueta, valor }, usados) {
  const delCatalogo = CATEGORIAS.find((c) => c.id === categoria);
  const nombre = delCatalogo ? null : String(etiqueta ?? '').trim().slice(0, 40);

  // Una categoría que el almacén tiene y el catálogo ya no —porque se quitó del código— se
  // conserva tal cual. Si se convirtiera en una pieza «propia», cambiarle el valor crearía una
  // segunda fila que dice lo mismo, porque las dos ya no compartirían clave.
  const heredada =
    !delCatalogo && !nombre && /^[a-z0-9-]{1,40}$/.test(String(categoria ?? '')) ? categoria : null;

  if (!delCatalogo && !nombre && !heredada) {
    return { error: 'Elige una categoría o escribe cuál es.' };
  }

  // Una categoría del menú sin número no sirve para nada: hay que elegir *algo* dentro del
  // submenú. Una línea escrita a mano sí puede ir sola —«revisar el motor», «falta pieza»—,
  // porque ahí el nombre ya es todo el recado.
  const limpio = String(valor ?? '').trim().slice(0, MAX_VALOR);
  if (!limpio && !nombre) {
    return { error: `Falta el número de «${delCatalogo?.nombre ?? heredada}».` };
  }

  return {
    pieza: {
      id: idPropuesto(id, usados),
      categoria: delCatalogo ? delCatalogo.id : heredada,
      etiqueta: nombre || null,
      valor: limpio,
      hecha: false,
    },
  };
}

/** Valida un montón de líneas de golpe: o entran todas o no entra ninguna. */
function interpretar(entradas, yaHay, usados = new Set()) {
  const lote = Array.isArray(entradas) ? entradas : [entradas];
  if (yaHay + lote.length > MAX_PIEZAS) {
    return { error: `Un pedido no puede llevar más de ${MAX_PIEZAS} piezas.` };
  }

  const piezas = [];
  for (const entrada of lote) {
    const { pieza, error } = piezaDe(entrada ?? {}, usados);
    if (error) return { error };
    // Dentro del mismo lote también: dos líneas con el mismo id serían la misma fila.
    usados.add(pieza.id);
    piezas.push(pieza);
  }
  return { piezas };
}

/**
 * Con qué se identifica una pieza dentro del pedido.
 *
 * **Una categoría vale una sola vez**, porque en el menú del juego también: no se puede
 * instalar dos techos. Volver a mandar «Techo» cambia el número en vez de dejar dos filas que
 * se contradicen. Las que no son del catálogo se distinguen por el nombre escrito.
 */
const claveDe = (p) => p.categoria ?? `otra:${String(p.etiqueta ?? '').toLowerCase()}`;

/** Añade una pieza o muchas, o le cambia el valor a las que ya estaban. */
export async function agregar(id, entradas) {
  const lista = await leer(TUNNING);
  const i = lista.findIndex((p) => p.id === id);
  if (i === -1) return { error: 'Ese pedido no existe.' };
  if (lista[i].cerrado) return { error: 'Ese pedido ya está cerrado.' };

  const previas = lista[i].piezas;
  const usados = new Set(previas.map((p) => p.id));
  const { piezas, error } = interpretar(entradas, 0, usados);
  if (error) return { error };
  if (!piezas.length) return { error: 'No hay nada que añadir.' };

  // Las que repiten categoría actualizan la que ya estaba; solo las nuevas se suman.
  const porClave = new Map(piezas.map((p) => [claveDe(p), p]));
  const quedan = previas.map((p) => {
    const nueva = porClave.get(claveDe(p));
    if (!nueva) return p;
    porClave.delete(claveDe(p));
    // Se conserva el id y el estado: cambiar el número no desmarca lo ya instalado.
    return { ...p, valor: nueva.valor };
  });

  const suman = [...porClave.values()];
  if (quedan.length + suman.length > MAX_PIEZAS) {
    return { error: `Un pedido no puede llevar más de ${MAX_PIEZAS} piezas.` };
  }

  const copia = [...lista];
  copia[i] = { ...copia[i], piezas: [...quedan, ...suman] };
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
