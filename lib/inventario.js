// El inventario de la bodega: qué hay y cuánto, actualizado desde capturas del juego.
//
//   { id, peso, nombre, cantidad, visto, vistoPor }
//
// Una captura **no es la bodega entera**: es la pantalla que se ve. Por eso cargar una captura
// es un upsert y no un reemplazo — lo que no sale en la foto se queda como estaba, con su fecha
// de «visto» sin tocar, que es justamente lo que permite darse cuenta de que hace días que
// nadie mira ese artículo.

import { leer, guardar } from './almacen.js';
// `export *` reexporta, pero no trae los nombres al ámbito de este archivo: lo que se usa acá
// dentro hay que importarlo aparte.
import {
  aplicables,
  completar,
  normalizarCantidad,
  normalizarNombre,
  normalizarPeso,
  partesNombre,
} from './inventario-lectura.js';

// Se reexporta para que quien ya importa `lib/inventario.js` en el servidor no tenga que saber
// que la parte pura vive aparte.
export * from './inventario-lectura.js';

export const INVENTARIO = 'sunset:inventario';
export const CARGAS = 'sunset:inventario-cargas';

const MAX_CARGAS = 30;

export async function listar() {
  const todos = await leer(INVENTARIO);
  // Por nombre, que es como se busca una pieza; el peso solo desempata.
  return [...todos].sort(
    (a, b) => a.nombre.localeCompare(b.nombre, 'es') || (a.peso ?? 0) - (b.peso ?? 0)
  );
}

/**
 * Guarda las filas confirmadas. Upsert: lo que no venía en la captura no se toca.
 *
 * Una sola lectura y una sola escritura, aunque vengan cuarenta artículos: cada llamada al
 * almacén lee y reescribe la colección entera.
 */
export async function aplicar(usuario, filas) {
  const buenas = aplicables(filas);
  if (!buenas.length) return { error: 'No hay nada que actualizar.' };

  const actuales = await leer(INVENTARIO);
  const porId = new Map(actuales.map((a) => [a.id, a]));
  const cuando = new Date().toISOString();

  let nuevos = 0;
  let cambiados = 0;

  for (const fila of buenas) {
    // La comparación ya decidió con qué artículo casa cada fila. Acá no se vuelve a adivinar:
    // si trae `id` y ese artículo existe, se actualiza; si no, es uno nuevo.
    const antes = fila.id ? porId.get(fila.id) : null;
    const cantidad = normalizarCantidad(fila.cantidad);
    const nombre = normalizarNombre(fila.nombre);
    if (cantidad === null || !nombre) continue;

    if (!antes) {
      nuevos += 1;
      const id = crypto.randomUUID();
      porId.set(id, {
        id,
        nombre,
        // Lo que el lector dedujo mirando la foto. Se guarda pero **no se aplica**: el nombre
        // sigue siendo el literal hasta que una persona acepte la propuesta.
        sugerido: completar(nombreLeido(fila), fila.sugerencia),
        peso: normalizarPeso(fila.peso) ?? null,
        cantidad,
        visto: cuando,
        vistoPor: usuario,
      });
      continue;
    }

    if (antes.cantidad !== cantidad) cambiados += 1;
    // **El peso guardado no se toca**: el lector lo trae con erratas y solo sirve para
    // desempatar homónimos.
    //
    // El nombre tampoco, salvo en un caso: si el guardado está cortado y llega uno entero que
    // empieza igual, se queda el entero. Así una captura con la ventana más ancha arregla los
    // «RAMPA DE REMO…» que dejó una anterior, en vez de que el nombre se quede a medias para
    // siempre. Un nombre escrito a mano nunca está cortado, así que no se pisa.
    const guardado = partesNombre(antes.nombre);
    const llega = partesNombre(nombreLeido(fila));
    const mejora =
      guardado.truncado && !llega.truncado && llega.base.startsWith(guardado.base)
        ? nombreLeido(fila)
        : antes.nombre;

    porId.set(antes.id, {
      ...antes,
      nombre: mejora,
      // La sugerencia se refresca aunque el nombre no cambie: una captura mejor puede traer una
      // deducción mejor, y solo se aplicará si alguien la acepta.
      sugerido: completar(nombreLeido(fila), fila.sugerencia) || antes.sugerido || '',
      cantidad,
      visto: cuando,
      vistoPor: usuario,
    });
  }

  await guardar(INVENTARIO, [...porId.values()]);
  await anotarCarga({ usuario, cuando, nuevos, cambiados, total: buenas.length });

  return { nuevos, cambiados, total: buenas.length };
}

/** El nombre tal como vino de la captura, no el que ya estaba guardado. */
const nombreLeido = (fila) => normalizarNombre(fila.leido ?? fila.nombre);

/** Quién cargó qué y cuándo. Un inventario sin rastro de quién lo tocó no se puede discutir. */
async function anotarCarga(carga) {
  const lista = await leer(CARGAS);
  await guardar(CARGAS, [{ id: crypto.randomUUID(), ...carga }, ...lista].slice(0, MAX_CARGAS));
}

export async function listarCargas() {
  return leer(CARGAS);
}

/** Corregir a mano: el nombre cortado por el juego, o una cantidad que la foto leyó mal. */
export async function corregir(id, { nombre, cantidad }) {
  const lista = await leer(INVENTARIO);
  const i = lista.findIndex((a) => a.id === id);
  if (i === -1) return { error: 'Ese artículo no existe.' };

  const copia = [...lista];
  const limpio = normalizarNombre(nombre ?? copia[i].nombre);
  const cuantos = cantidad === undefined ? copia[i].cantidad : normalizarCantidad(cantidad);
  if (!limpio) return { error: 'El artículo necesita un nombre.' };
  if (cuantos === null) return { error: 'La cantidad no es un número válido.' };

  copia[i] = { ...copia[i], nombre: limpio, cantidad: cuantos };
  await guardar(INVENTARIO, copia);
  return { articulo: copia[i] };
}

/**
 * Renombra varios de una vez: una lectura y una escritura, no una por artículo.
 *
 * Lo usa el completado de nombres cortados, que toca doce filas de golpe.
 */
export async function corregirVarios(cambios) {
  const lista = await leer(INVENTARIO);
  const porId = new Map(lista.map((a) => [a.id, a]));
  let tocados = 0;

  for (const { id, nombre } of cambios) {
    const antes = porId.get(id);
    const limpio = normalizarNombre(nombre);
    if (!antes || !limpio || limpio === antes.nombre) continue;
    porId.set(id, { ...antes, nombre: limpio });
    tocados += 1;
  }

  if (tocados) await guardar(INVENTARIO, [...porId.values()]);
  return { tocados };
}

export async function borrar(id) {
  const lista = await leer(INVENTARIO);
  if (!lista.some((a) => a.id === id)) return { error: 'Ese artículo no existe.' };
  await guardar(INVENTARIO, lista.filter((a) => a.id !== id));
  return { ok: true };
}
