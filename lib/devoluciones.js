// Solicitudes de devolución de dinero.
//
//   { id, usuario, monto, descripcion, imagen, enlace, estado, respuesta, resuelto,
//     resueltoPor, creado, enviado }
//
// Estados y quién los mueve:
//
//   borrador  -> pendiente   el propio mecánico, con "Enviar"
//   pendiente -> pagado      el administrador, cuando ya le devolvió la plata
//   pendiente -> rechazado   el administrador
//
// La captura del juego es obligatoria al enviar: es la prueba del monto. Se puede guardar
// un borrador sin ella, pero no mandarlo. Vale subir el archivo **o pegar la URL** que deja
// FiveM al hacer la captura: ver `normalizarEnlace()`.

import { leer, guardar } from './almacen.js';
import { borrarImagen } from './imagenes.js';

export const DEVOLUCIONES = 'sunset:devoluciones';

export const MAX_DESCRIPCION = 300;
export const MAX_RESPUESTA = 300;
export const MAX_MONTO = 100_000_000;

export const ROTULOS = {
  borrador: 'Borrador',
  pendiente: 'Pendiente de pagar',
  pagado: 'Pagado',
  rechazado: 'Rechazado',
};

const ordenar = (lista) => [...lista].sort((a, b) => b.creado.localeCompare(a.creado));

/** Sin resolver todavía: su dueño la puede tocar. */
export const editable = (d) => d.estado === 'borrador' || d.estado === 'pendiente';

/** Acepta "12.500", "12500" y "12,500"; devuelve un entero o null. */
export function normalizarMonto(valor) {
  if (typeof valor === 'number') return Number.isFinite(valor) ? Math.round(valor) : null;
  if (typeof valor !== 'string') return null;
  const limpio = valor.replace(/[^\d]/g, '');
  if (!limpio) return null;
  return parseInt(limpio, 10);
}

function validar({ monto, descripcion }) {
  const n = normalizarMonto(monto);
  if (n === null || n <= 0) return 'Escribe el monto que te deben devolver.';
  if (n > MAX_MONTO) return 'Ese monto es demasiado alto: revísalo.';
  if (typeof descripcion !== 'string' || !descripcion.trim()) {
    return 'Explica de qué es la devolución.';
  }
  return null;
}

export async function listar(usuario) {
  const todas = await leer(DEVOLUCIONES);
  return ordenar(usuario ? todas.filter((d) => d.usuario === usuario) : todas);
}

/** Solo las enviadas: los borradores ajenos no le incumben al administrador. */
export async function listarEnviadas() {
  const todas = await leer(DEVOLUCIONES);
  return ordenar(todas.filter((d) => d.estado !== 'borrador'));
}

export async function porId(id) {
  return (await leer(DEVOLUCIONES)).find((d) => d.id === id) ?? null;
}

/**
 * La captura puede venir de dos sitios: un archivo subido o **un enlace pegado**.
 *
 * Lo segundo es para FiveM: la captura del juego ya queda subida en algún sitio y sale una
 * URL, así que obligar a bajarla y volver a subirla es trabajo por nada.
 *
 * Se valida el enlace pero **no se descarga**. Que el servidor fuera a buscar una URL que
 * escribe cualquiera es pedir que le pidan cosas de la red interna; el navegador de quien
 * mira la solicitud es el que carga la imagen, como con cualquier enlace.
 */
export function normalizarEnlace(valor) {
  const limpio = typeof valor === 'string' ? valor.trim() : '';
  if (!limpio) return { enlace: null };
  if (limpio.length > 600) return { error: 'Ese enlace es demasiado largo.' };

  let url;
  try {
    url = new URL(limpio);
  } catch {
    return { error: 'Ese enlace no se entiende. Pega la URL completa.' };
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return { error: 'El enlace tiene que empezar por http:// o https://' };
  }
  return { enlace: url.toString() };
}

/** Tiene prueba del monto: la subió o pegó el enlace. */
export const tieneCaptura = (d) => Boolean(d.imagen || d.enlace);

export async function crear(usuario, datos) {
  const error = validar(datos);
  if (error) return { error };

  const { enlace, error: malEnlace } = normalizarEnlace(datos.enlace);
  if (malEnlace) return { error: malEnlace };

  if (datos.enviar && !datos.imagen && !enlace) {
    return { error: 'Para enviarla hace falta la captura del monto.' };
  }

  const lista = await leer(DEVOLUCIONES);
  const ahora = new Date().toISOString();
  const devolucion = {
    id: crypto.randomUUID(),
    usuario,
    monto: normalizarMonto(datos.monto),
    descripcion: datos.descripcion.trim().slice(0, MAX_DESCRIPCION),
    imagen: datos.imagen ?? null,
    enlace,
    estado: datos.enviar ? 'pendiente' : 'borrador',
    respuesta: null,
    resuelto: null,
    resueltoPor: null,
    creado: ahora,
    enviado: datos.enviar ? ahora : null,
  };
  await guardar(DEVOLUCIONES, [devolucion, ...lista]);
  return { devolucion };
}

export async function editar(id, usuario, datos) {
  const lista = await leer(DEVOLUCIONES);
  const i = lista.findIndex((d) => d.id === id);
  if (i === -1) return { error: 'Esa solicitud no existe.' };
  if (lista[i].usuario !== usuario) return { error: 'No es tuya.' };
  if (!editable(lista[i])) return { error: 'Ya fue resuelta: no se puede editar.' };

  const mezcla = { ...lista[i], ...datos };
  const error = validar(mezcla);
  if (error) return { error };

  // Si llega una imagen nueva, la anterior se borra: si no, quedaría ocupando espacio sin
  // que nadie pueda volver a verla.
  const imagenPrevia = lista[i].imagen;
  const imagen = datos.imagen ?? imagenPrevia;
  if (datos.imagen && imagenPrevia && datos.imagen !== imagenPrevia) {
    await borrarImagen(imagenPrevia);
  }

  // El enlace solo se toca si vino en la edición: `undefined` es "déjalo como estaba",
  // cadena vacía es "quítalo".
  let enlace = lista[i].enlace ?? null;
  if (datos.enlace !== undefined) {
    const limpio = normalizarEnlace(datos.enlace);
    if (limpio.error) return { error: limpio.error };
    enlace = limpio.enlace;
  }

  const copia = [...lista];
  copia[i] = {
    ...copia[i],
    monto: normalizarMonto(mezcla.monto),
    descripcion: mezcla.descripcion.trim().slice(0, MAX_DESCRIPCION),
    imagen,
    enlace,
  };
  await guardar(DEVOLUCIONES, copia);
  return { devolucion: copia[i] };
}

export async function enviar(id, usuario) {
  const lista = await leer(DEVOLUCIONES);
  const i = lista.findIndex((d) => d.id === id);
  if (i === -1) return { error: 'Esa solicitud no existe.' };
  if (lista[i].usuario !== usuario) return { error: 'No es tuya.' };
  if (lista[i].estado !== 'borrador') return { error: 'Esta solicitud ya fue enviada.' };
  if (!tieneCaptura(lista[i])) {
    return { error: 'Para enviarla hace falta la captura del monto.' };
  }

  const copia = [...lista];
  copia[i] = { ...copia[i], estado: 'pendiente', enviado: new Date().toISOString() };
  await guardar(DEVOLUCIONES, copia);
  return { devolucion: copia[i] };
}

export async function borrar(id, usuario, admin) {
  const lista = await leer(DEVOLUCIONES);
  const d = lista.find((x) => x.id === id);
  if (!d) return { error: 'Esa solicitud no existe.' };
  if (!admin) {
    if (d.usuario !== usuario) return { error: 'No es tuya.' };
    if (!editable(d)) return { error: 'Ya fue resuelta: no se puede borrar.' };
  }
  await guardar(DEVOLUCIONES, lista.filter((x) => x.id !== id));
  await borrarImagen(d.imagen);
  return { ok: true, devolucion: d };
}

/** Decisión del administrador: 'pagado' o 'rechazado'. */
export async function resolver(id, estado, respuesta, porQuien) {
  if (!['pagado', 'rechazado'].includes(estado)) return { error: 'Decisión no válida.' };

  const lista = await leer(DEVOLUCIONES);
  const i = lista.findIndex((d) => d.id === id);
  if (i === -1) return { error: 'Esa solicitud no existe.' };
  if (lista[i].estado === 'borrador') return { error: 'Todavía es un borrador de su autor.' };

  const copia = [...lista];
  copia[i] = {
    ...copia[i],
    estado,
    respuesta: typeof respuesta === 'string' ? respuesta.trim().slice(0, MAX_RESPUESTA) : null,
    resuelto: new Date().toISOString(),
    resueltoPor: porQuien,
  };
  await guardar(DEVOLUCIONES, copia);
  return { devolucion: copia[i] };
}
