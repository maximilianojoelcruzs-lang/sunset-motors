// Documentos del taller: contratos, reglamento, manuales, acuerdos con otras
// organizaciones. Lo que hoy vive tirado en un canal de Discord.
//
//   { id, titulo, descripcion, categoria, archivo, tipo, tamano, creado, creadoPor }
//
// Igual que los flyers: el encargado publica, todo el taller consulta. Sin estados ni
// aprobaciones — un reglamento no se "aprueba", se publica.
//
// La categoría es texto libre a propósito. Una lista cerrada obligaría a tocar código cada
// vez que el taller inventa un tipo de documento nuevo, que es justo lo que estamos
// sacando de en medio.

import { leer, guardar } from './almacen.js';
import { borrarImagen } from './imagenes.js';

export const DOCUMENTOS = 'sunset:documentos';

export const MAX_TITULO = 90;
export const MAX_DESCRIPCION = 300;
export const MAX_CATEGORIA = 40;

// Las sugerencias de categoría viven en el componente, no acá: son solo una ayuda del
// formulario y este módulo importa almacen.js, que usa node:fs y no puede llegar al
// navegador.

const SIN_CATEGORIA = 'Sin categoría';

export async function listar() {
  const todos = await leer(DOCUMENTOS);
  return [...todos].sort(
    (a, b) =>
      a.categoria.localeCompare(b.categoria, 'es') || b.creado.localeCompare(a.creado)
  );
}

export async function porId(id) {
  return (await leer(DOCUMENTOS)).find((d) => d.id === id) ?? null;
}

function validar({ titulo }) {
  if (typeof titulo !== 'string' || !titulo.trim()) return 'Ponle un título al documento.';
  return null;
}

export async function crear(usuario, datos) {
  const error = validar(datos);
  if (error) return { error };
  if (!datos.archivo) return { error: 'Falta el archivo.' };

  const lista = await leer(DOCUMENTOS);
  const documento = {
    id: crypto.randomUUID(),
    titulo: datos.titulo.trim().slice(0, MAX_TITULO),
    descripcion: (datos.descripcion ?? '').trim().slice(0, MAX_DESCRIPCION),
    categoria: (datos.categoria ?? '').trim().slice(0, MAX_CATEGORIA) || SIN_CATEGORIA,
    archivo: datos.archivo,
    tipo: datos.tipo,
    tamano: datos.tamano ?? 0,
    creado: new Date().toISOString(),
    creadoPor: usuario,
  };
  await guardar(DOCUMENTOS, [documento, ...lista]);
  return { documento };
}

/** Solo los datos: para cambiar el archivo se sube uno nuevo y se borra el viejo. */
export async function editar(id, datos) {
  const lista = await leer(DOCUMENTOS);
  const i = lista.findIndex((d) => d.id === id);
  if (i === -1) return { error: 'Ese documento no existe.' };

  const mezcla = { ...lista[i], ...datos };
  const error = validar(mezcla);
  if (error) return { error };

  const copia = [...lista];
  copia[i] = {
    ...copia[i],
    titulo: mezcla.titulo.trim().slice(0, MAX_TITULO),
    descripcion: (mezcla.descripcion ?? '').trim().slice(0, MAX_DESCRIPCION),
    categoria: (mezcla.categoria ?? '').trim().slice(0, MAX_CATEGORIA) || SIN_CATEGORIA,
  };
  await guardar(DOCUMENTOS, copia);
  return { documento: copia[i] };
}

export async function borrar(id) {
  const lista = await leer(DOCUMENTOS);
  const documento = lista.find((d) => d.id === id);
  if (!documento) return { error: 'Ese documento no existe.' };

  await guardar(DOCUMENTOS, lista.filter((d) => d.id !== id));
  // El archivo se va con él: si no, queda ocupando espacio sin nada que lo muestre.
  await borrarImagen(documento.archivo);
  return { ok: true };
}
