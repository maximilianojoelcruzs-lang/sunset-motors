// El catálogo de precios, editable desde el panel.
//
// `lib/catalogo.js` deja de ser la fuente de verdad y pasa a ser la **semilla**: lo que se
// usa la primera vez, cuando la base todavía no tiene nada guardado. Desde que alguien
// guarda un cambio, manda la base.
//
// Cada ítem lleva un `id` propio. Antes la cantidad se guardaba por posición en el arreglo,
// lo que daba igual mientras el catálogo fuera fijo; ahora que el encargado puede reordenar
// y borrar ítems, una clave posicional haría que las cantidades saltaran de producto.

import { leer, guardar } from './almacen.js';
import { SECCIONES, TINTES } from './catalogo.js';

export const CATALOGO = 'sunset:catalogo';

export const MAX_TITULO = 40;
export const MAX_NOMBRE = 60;
export const MAX_PRECIO = 10_000_000;
export const MAX_SECCIONES = 20;
export const MAX_ITEMS = 60;

const idNuevo = () => crypto.randomUUID().slice(0, 8);

/** Le pone id a los ítems de la semilla, que no lo traen. */
function conIds(secciones) {
  return secciones.map((s) => ({
    ...s,
    items: s.items.map((item) => ({ ...item, id: item.id ?? idNuevo() })),
  }));
}

export async function obtener() {
  const guardado = await leer(CATALOGO, null);
  return guardado?.secciones?.length ? guardado : { secciones: conIds(SECCIONES), actualizado: null, actualizadoPor: null };
}

/** true si todavía no lo han editado: el panel lo dice para que se note de dónde salen. */
export async function esSemilla() {
  const guardado = await leer(CATALOGO, null);
  return !guardado?.secciones?.length;
}

function validar(secciones) {
  if (!Array.isArray(secciones) || !secciones.length) {
    return 'El catálogo no puede quedar vacío.';
  }
  if (secciones.length > MAX_SECCIONES) return `No más de ${MAX_SECCIONES} secciones.`;

  const idsSeccion = new Set();

  for (const s of secciones) {
    if (typeof s?.titulo !== 'string' || !s.titulo.trim()) {
      return 'Todas las secciones necesitan un título.';
    }
    if (typeof s?.id !== 'string' || !/^[a-z0-9-]{2,30}$/.test(s.id)) {
      return `La sección «${s.titulo}» tiene un identificador no válido.`;
    }
    if (idsSeccion.has(s.id)) return `Hay dos secciones con el identificador «${s.id}».`;
    idsSeccion.add(s.id);

    if (!Array.isArray(s.items) || !s.items.length) {
      return `La sección «${s.titulo}» no tiene ningún ítem.`;
    }
    if (s.items.length > MAX_ITEMS) {
      return `La sección «${s.titulo}» pasa de ${MAX_ITEMS} ítems.`;
    }

    for (const item of s.items) {
      if (typeof item?.nombre !== 'string' || !item.nombre.trim()) {
        return `Hay un ítem sin nombre en «${s.titulo}».`;
      }
      const precio = Number(item.precio);
      if (!Number.isFinite(precio) || precio < 0 || precio > MAX_PRECIO) {
        return `El precio de «${item.nombre}» no es válido.`;
      }
    }
  }

  return null;
}

/** Deja todo en forma canónica: recortado, con ids y sin campos de más. */
function limpiar(secciones) {
  return secciones.map((s) => ({
    id: s.id,
    titulo: s.titulo.trim().slice(0, MAX_TITULO),
    tinte: TINTES.includes(s.tinte) ? s.tinte : TINTES[0],
    items: s.items.map((item) => ({
      id: typeof item.id === 'string' && item.id ? item.id : idNuevo(),
      nombre: item.nombre.trim().slice(0, MAX_NOMBRE),
      precio: Math.round(Number(item.precio)),
      ...(item.revisar ? { revisar: true } : {}),
    })),
  }));
}

export async function reemplazar(secciones, usuario) {
  const error = validar(secciones);
  if (error) return { error };

  const catalogo = {
    secciones: limpiar(secciones),
    actualizado: new Date().toISOString(),
    actualizadoPor: usuario,
  };
  await guardar(CATALOGO, catalogo);
  return { catalogo };
}

/** Vuelve al catálogo que trae el código, por si alguien deja los precios inservibles. */
export async function restaurarSemilla(usuario) {
  const catalogo = {
    secciones: conIds(SECCIONES),
    actualizado: new Date().toISOString(),
    actualizadoPor: usuario,
  };
  await guardar(CATALOGO, catalogo);
  return { catalogo };
}
