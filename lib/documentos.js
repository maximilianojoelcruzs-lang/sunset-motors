// Documentos del taller: contratos, reglamento, manuales, acuerdos con otras
// organizaciones. Lo que hoy vive tirado en un canal de Discord.
//
//   { id, titulo, descripcion, categoria, archivo, tipo, tamano, creado, creadoPor, para }
//
// Igual que los flyers: el encargado publica, todo el taller consulta. Sin estados ni
// aprobaciones — un reglamento no se "aprueba", se publica.
//
// La categoría es texto libre a propósito. Una lista cerrada obligaría a tocar código cada
// vez que el taller inventa un tipo de documento nuevo, que es justo lo que estamos
// sacando de en medio.
//
// **`para` es a quién se le asignó.** Vacío significa «para todo el taller», que es como se
// comportaban todos hasta ahora: los documentos que ya existen no traen el campo y siguen
// viéndose igual. Con nombres dentro, solo esa gente lo ve — un contrato es de quien lo
// firma, no del taller entero. El administrador ve todos, siempre.

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

const limpiarPara = (para) =>
  Array.isArray(para)
    ? [...new Set(para.map((u) => String(u).trim().toLowerCase()).filter(Boolean))]
    : [];

/** Sin asignar es de todos; asignado, solo de quien esté en la lista. */
export const esParaTodos = (documento) => !documento.para?.length;

export const puedeVerlo = (documento, usuario) =>
  esParaTodos(documento) ||
  documento.para.includes(String(usuario ?? '').trim().toLowerCase());

/** Todos, en orden. Es lo que ve el administrador. */
export async function listar() {
  const todos = await leer(DOCUMENTOS);
  return [...todos].sort(
    (a, b) =>
      a.categoria.localeCompare(b.categoria, 'es') || b.creado.localeCompare(a.creado)
  );
}

/**
 * Los que le tocan a alguien.
 *
 * El filtro va acá y no en la pantalla: esconder una fila en el navegador deja el documento
 * a un `fetch` de distancia de cualquiera.
 */
export async function listarPara(usuario) {
  return (await listar()).filter((d) => puedeVerlo(d, usuario));
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
    para: limpiarPara(datos.para),
  };
  await guardar(DOCUMENTOS, [documento, ...lista]);
  return { documento };
}

/**
 * Cambia a quién está asignado. Lista vacía = vuelve a ser de todo el taller.
 *
 * Se guarda entera y no de a uno para que asignar y desasignar sean la misma operación:
 * dos llamadas distintas se desincronizan en cuanto alguien tenga la pantalla abierta.
 */
export async function asignar(id, para) {
  const lista = await leer(DOCUMENTOS);
  const i = lista.findIndex((d) => d.id === id);
  if (i === -1) return { error: 'Ese documento no existe.' };

  const copia = [...lista];
  copia[i] = { ...copia[i], para: limpiarPara(para) };
  await guardar(DOCUMENTOS, copia);
  return { documento: copia[i] };
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
