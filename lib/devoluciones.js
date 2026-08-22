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

import { cambiar, leer } from './almacen.js';
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

/** Las dos listas de la pantalla de una sola lectura. Ver `listarPara` en licencias.js. */
export async function listarPara(usuario, admin) {
  const todas = await leer(DEVOLUCIONES);
  return {
    mias: ordenar(todas.filter((d) => d.usuario === usuario)),
    enviadas: admin ? ordenar(todas.filter((d) => d.estado !== 'borrador')) : [],
  };
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

  // Fuera del cambio, para que un reintento guarde esta misma devolución y no otra.
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
  return cambiar(DEVOLUCIONES, (lista) => ({
    lista: [devolucion, ...lista],
    valor: { devolucion },
  }));
}

/**
 * Una solicitud que crea el sistema, no una persona: hoy, los premios del top de wager.
 *
 * Nace ya **pendiente de pagar** y **sin captura**. La prueba no es una foto: es el ciclo
 * cerrado, que queda guardado con el podio y con quién lo cerró. Por eso no pasa por la
 * comprobación de `tieneCaptura()`, que es la que obliga a la captura cuando la escribe alguien.
 *
 * Va marcada con `origen` para que su dueño no la pueda editar ni borrar: si no, quien ganó el
 * primer puesto podría cambiarle el monto a 300.000 y dejarla esperando en la lista del
 * encargado como si fuera suya.
 */
export async function crearDelSistema({ usuario, monto, descripcion, origen }) {
  const n = normalizarMonto(monto);
  if (!usuario || n === null || n <= 0) return { error: 'Premio no válido.' };

  const ahora = new Date().toISOString();
  const devolucion = {
    id: crypto.randomUUID(),
    usuario,
    monto: n,
    descripcion: String(descripcion ?? '').trim().slice(0, MAX_DESCRIPCION),
    imagen: null,
    enlace: null,
    estado: 'pendiente',
    respuesta: null,
    resuelto: null,
    resueltoPor: null,
    creado: ahora,
    enviado: ahora,
    origen: origen ?? 'sistema',
  };

  return cambiar(DEVOLUCIONES, (lista) => ({
    lista: [devolucion, ...lista],
    valor: { devolucion },
  }));
}

/** Las que generó el sistema no las toca su dueño: no las escribió él. */
const delSistema = (d) => Boolean(d.origen);

export async function editar(id, usuario, datos) {
  const resultado = await cambiar(DEVOLUCIONES, (lista) => {
    const i = lista.findIndex((d) => d.id === id);
    if (i === -1) return { error: 'Esa solicitud no existe.' };
    if (lista[i].usuario !== usuario) return { error: 'No es tuya.' };
    if (delSistema(lista[i])) return { error: 'Esta solicitud la generó el sistema: no se edita.' };
    if (!editable(lista[i])) return { error: 'Ya fue resuelta: no se puede editar.' };

    const mezcla = { ...lista[i], ...datos };
    const error = validar(mezcla);
    if (error) return { error };

    const imagenPrevia = lista[i].imagen;
    const imagen = datos.imagen ?? imagenPrevia;

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
    return {
      lista: copia,
      valor: {
        devolucion: copia[i],
        // La captura anterior se borra **después** de que el cambio quedó guardado: borrarla
        // antes y que la escritura fallara dejaría la solicitud apuntando a una imagen que
        // ya no existe.
        sobra: datos.imagen && imagenPrevia && datos.imagen !== imagenPrevia ? imagenPrevia : null,
      },
    };
  });

  if (resultado.sobra) await borrarImagen(resultado.sobra);
  return resultado.error ? resultado : { devolucion: resultado.devolucion };
}

export async function enviar(id, usuario) {
  const enviado = new Date().toISOString();
  return cambiar(DEVOLUCIONES, (lista) => {
    const i = lista.findIndex((d) => d.id === id);
    if (i === -1) return { error: 'Esa solicitud no existe.' };
    if (lista[i].usuario !== usuario) return { error: 'No es tuya.' };
    if (lista[i].estado !== 'borrador') return { error: 'Esta solicitud ya fue enviada.' };
    if (!tieneCaptura(lista[i])) {
      return { error: 'Para enviarla hace falta la captura del monto.' };
    }

    const copia = [...lista];
    copia[i] = { ...copia[i], estado: 'pendiente', enviado };
    return { lista: copia, valor: { devolucion: copia[i] } };
  });
}

export async function borrar(id, usuario, admin) {
  const resultado = await cambiar(DEVOLUCIONES, (lista) => {
    const d = lista.find((x) => x.id === id);
    if (!d) return { error: 'Esa solicitud no existe.' };
    if (!admin) {
      if (d.usuario !== usuario) return { error: 'No es tuya.' };
      if (delSistema(d)) return { error: 'Esta solicitud la generó el sistema: la borra el encargado.' };
      if (!editable(d)) return { error: 'Ya fue resuelta: no se puede borrar.' };
    }
    return { lista: lista.filter((x) => x.id !== id), valor: { ok: true, devolucion: d } };
  });

  if (resultado.devolucion) await borrarImagen(resultado.devolucion.imagen);
  return resultado;
}

/** Decisión del administrador: 'pagado' o 'rechazado'. */
export async function resolver(id, estado, respuesta, porQuien) {
  if (!['pagado', 'rechazado'].includes(estado)) return { error: 'Decisión no válida.' };

  const resuelto = new Date().toISOString();
  return cambiar(DEVOLUCIONES, (lista) => {
    const i = lista.findIndex((d) => d.id === id);
    if (i === -1) return { error: 'Esa solicitud no existe.' };
    if (lista[i].estado === 'borrador') return { error: 'Todavía es un borrador de su autor.' };

    const copia = [...lista];
    copia[i] = {
      ...copia[i],
      estado,
      respuesta: typeof respuesta === 'string' ? respuesta.trim().slice(0, MAX_RESPUESTA) : null,
      resuelto,
      resueltoPor: porQuien,
    };
    return { lista: copia, valor: { devolucion: copia[i] } };
  });
}
