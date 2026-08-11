// Inventario del taller dentro del juego.
//
//   { items: [{ nombre, cantidad }], actualizado, actualizadoPor, anterior }
//
// `anterior` guarda la versión previa completa. Existe porque el inventario se actualiza
// leyendo una captura con OCR, y el OCR se equivoca: si alguien confirma un escaneo malo y
// pisa el inventario bueno, hay de dónde volver. Solo se guarda una versión hacia atrás.

import { leer, guardar } from './almacen.js';

export const BODEGA = 'sunset:bodega';

export const MAX_NOMBRE = 60;
export const MAX_ITEMS = 300;

const VACIA = { items: [], actualizado: null, actualizadoPor: null, anterior: null };

export async function obtener() {
  const guardada = await leer(BODEGA, null);
  return guardada ?? VACIA;
}

/**
 * Deja la lista en forma canónica: nombres recortados, cantidades enteras positivas, sin
 * repetidos (se suman) y ordenada alfabéticamente.
 */
export function normalizar(items) {
  if (!Array.isArray(items)) return [];

  const porNombre = new Map();

  for (const item of items) {
    const nombre = String(item?.nombre ?? '').trim().slice(0, MAX_NOMBRE);
    if (!nombre) continue;

    const cantidad = Math.max(1, Math.min(999999, Math.floor(Number(item?.cantidad) || 1)));
    const clave = nombre.toLowerCase();

    // Repetidos se suman en vez de pisarse: una captura puede traer el mismo producto en
    // dos filas si el inventario lo separa por pilas.
    const previo = porNombre.get(clave);
    porNombre.set(clave, previo ? { nombre: previo.nombre, cantidad: previo.cantidad + cantidad } : { nombre, cantidad });
  }

  return [...porNombre.values()]
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
    .slice(0, MAX_ITEMS);
}

/** Suma dos listas, para cuando la captura es solo una parte del inventario. */
export function sumar(actuales, nuevos) {
  return normalizar([...actuales, ...nuevos]);
}

export async function reemplazar(items, usuario) {
  const limpios = normalizar(items);
  if (!limpios.length) return { error: 'La lista quedó vacía: revísala antes de guardar.' };

  const actual = await obtener();
  const bodega = {
    items: limpios,
    actualizado: new Date().toISOString(),
    actualizadoPor: usuario,
    anterior: actual.actualizado
      ? { items: actual.items, actualizado: actual.actualizado, actualizadoPor: actual.actualizadoPor }
      : null,
  };
  await guardar(BODEGA, bodega);
  return { bodega };
}

/** Vuelve a la versión previa. La actual pasa a ser la "anterior", así se puede deshacer. */
export async function restaurar() {
  const actual = await obtener();
  if (!actual.anterior) return { error: 'No hay una versión anterior guardada.' };

  const bodega = {
    items: actual.anterior.items,
    actualizado: actual.anterior.actualizado,
    actualizadoPor: actual.anterior.actualizadoPor,
    anterior: {
      items: actual.items,
      actualizado: actual.actualizado,
      actualizadoPor: actual.actualizadoPor,
    },
  };
  await guardar(BODEGA, bodega);
  return { bodega };
}
