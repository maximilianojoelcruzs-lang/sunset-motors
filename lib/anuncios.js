// Flyers y mensajes de anuncio.
//
// Dos colecciones distintas porque son dos cosas distintas:
//
//   flyers    { id, titulo, imagen, creado, creadoPor }   imágenes que publica el encargado
//   mensajes  { id, titulo, texto, creado, creadoPor }    textos listos para copiar y pegar
//
// A diferencia de licencias y devoluciones, acá no hay estados ni aprobaciones: el
// encargado publica y todo el taller lo ve. Los mecánicos solo miran y copian.

import { leer, guardar } from './almacen.js';
import { borrarImagen } from './imagenes.js';

export const FLYERS = 'sunset:flyers';
export const MENSAJES = 'sunset:mensajes';

export const MAX_TITULO = 80;
export const MAX_TEXTO = 2000;

const ordenar = (lista) => [...lista].sort((a, b) => b.creado.localeCompare(a.creado));

// ---------- Flyers ----------

export async function listarFlyers() {
  return ordenar(await leer(FLYERS));
}

export async function flyerPorId(id) {
  return (await leer(FLYERS)).find((f) => f.id === id) ?? null;
}

export async function crearFlyer(usuario, { titulo, imagen }) {
  if (!imagen) return { error: 'Falta la imagen del flyer.' };
  if (typeof titulo !== 'string' || !titulo.trim()) return { error: 'Ponle un título.' };

  const lista = await leer(FLYERS);
  const flyer = {
    id: crypto.randomUUID(),
    titulo: titulo.trim().slice(0, MAX_TITULO),
    imagen,
    creado: new Date().toISOString(),
    creadoPor: usuario,
  };
  await guardar(FLYERS, [flyer, ...lista]);
  return { flyer };
}

export async function renombrarFlyer(id, titulo) {
  if (typeof titulo !== 'string' || !titulo.trim()) return { error: 'Ponle un título.' };

  const lista = await leer(FLYERS);
  const i = lista.findIndex((f) => f.id === id);
  if (i === -1) return { error: 'Ese flyer no existe.' };

  const copia = [...lista];
  copia[i] = { ...copia[i], titulo: titulo.trim().slice(0, MAX_TITULO) };
  await guardar(FLYERS, copia);
  return { flyer: copia[i] };
}

export async function borrarFlyer(id) {
  const lista = await leer(FLYERS);
  const flyer = lista.find((f) => f.id === id);
  if (!flyer) return { error: 'Ese flyer no existe.' };

  await guardar(FLYERS, lista.filter((f) => f.id !== id));
  // La imagen se va con él: si no, queda ocupando espacio sin nada que la muestre.
  await borrarImagen(flyer.imagen);
  return { ok: true };
}

// ---------- Mensajes ----------

export async function listarMensajes() {
  return ordenar(await leer(MENSAJES));
}

function validarMensaje({ titulo, texto }) {
  if (typeof titulo !== 'string' || !titulo.trim()) return 'Ponle un título al mensaje.';
  if (typeof texto !== 'string' || !texto.trim()) return 'Escribe el texto del mensaje.';
  return null;
}

export async function crearMensaje(usuario, datos) {
  const error = validarMensaje(datos);
  if (error) return { error };

  const lista = await leer(MENSAJES);
  const mensaje = {
    id: crypto.randomUUID(),
    titulo: datos.titulo.trim().slice(0, MAX_TITULO),
    texto: datos.texto.trim().slice(0, MAX_TEXTO),
    creado: new Date().toISOString(),
    creadoPor: usuario,
  };
  await guardar(MENSAJES, [mensaje, ...lista]);
  return { mensaje };
}

export async function editarMensaje(id, datos) {
  const lista = await leer(MENSAJES);
  const i = lista.findIndex((m) => m.id === id);
  if (i === -1) return { error: 'Ese mensaje no existe.' };

  const mezcla = { ...lista[i], ...datos };
  const error = validarMensaje(mezcla);
  if (error) return { error };

  const copia = [...lista];
  copia[i] = {
    ...copia[i],
    titulo: mezcla.titulo.trim().slice(0, MAX_TITULO),
    texto: mezcla.texto.trim().slice(0, MAX_TEXTO),
  };
  await guardar(MENSAJES, copia);
  return { mensaje: copia[i] };
}

export async function borrarMensaje(id) {
  const lista = await leer(MENSAJES);
  if (!lista.some((m) => m.id === id)) return { error: 'Ese mensaje no existe.' };
  await guardar(MENSAJES, lista.filter((m) => m.id !== id));
  return { ok: true };
}
