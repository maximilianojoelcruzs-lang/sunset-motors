// Solicitudes de licencia y ausencia.
//
//   { id, usuario, tipo, inicio, fin, motivo, estado, respuesta, resuelto, resueltoPor,
//     creado, enviado }
//
// Estados y quién los mueve:
//
//   borrador  -> enviada    el propio mecánico, con "Enviar"
//   enviada   -> aprobada   el administrador
//   enviada   -> rechazada  el administrador
//
// Mientras esté en borrador o enviada, el dueño puede editarla o borrarla: una solicitud
// sin resolver todavía no compromete a nadie. Una vez aprobada o rechazada queda de solo
// lectura, porque es el registro de una decisión.

import { leer, guardar } from './almacen.js';

export const LICENCIAS = 'sunset:licencias';

export const TIPOS = ['licencia', 'ausencia'];
export const MAX_MOTIVO = 400;
export const MAX_RESPUESTA = 300;

const ordenar = (lista) => [...lista].sort((a, b) => b.creado.localeCompare(a.creado));

/** Una solicitud sin resolver todavía la puede tocar su dueño. */
export const editable = (s) => s.estado === 'borrador' || s.estado === 'enviada';

/** 'AAAA-MM-DD' — lo que entrega un <input type="date">. */
const esFecha = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

function validar({ tipo, inicio, fin, motivo }) {
  if (!TIPOS.includes(tipo)) return 'Elige si es una licencia o una ausencia.';
  if (!esFecha(inicio)) return 'La fecha de inicio no es válida.';
  if (!esFecha(fin)) return 'La fecha de término no es válida.';
  if (fin < inicio) return 'La fecha de término no puede ser anterior a la de inicio.';
  if (typeof motivo !== 'string' || !motivo.trim()) return 'Escribe el motivo.';
  return null;
}

export async function listar(usuario) {
  const todas = await leer(LICENCIAS);
  return ordenar(usuario ? todas.filter((s) => s.usuario === usuario) : todas);
}

/** Solo las que ya fueron enviadas: los borradores ajenos no le incumben al admin. */
export async function listarEnviadas() {
  const todas = await leer(LICENCIAS);
  return ordenar(todas.filter((s) => s.estado !== 'borrador'));
}

export async function crear(usuario, datos) {
  const error = validar(datos);
  if (error) return { error };

  const lista = await leer(LICENCIAS);
  const ahora = new Date().toISOString();
  const solicitud = {
    id: crypto.randomUUID(),
    usuario,
    tipo: datos.tipo,
    inicio: datos.inicio,
    fin: datos.fin,
    motivo: datos.motivo.trim().slice(0, MAX_MOTIVO),
    estado: datos.enviar ? 'enviada' : 'borrador',
    respuesta: null,
    resuelto: null,
    resueltoPor: null,
    creado: ahora,
    enviado: datos.enviar ? ahora : null,
  };
  await guardar(LICENCIAS, [solicitud, ...lista]);
  return { solicitud };
}

export async function editar(id, usuario, datos) {
  const lista = await leer(LICENCIAS);
  const i = lista.findIndex((s) => s.id === id);
  if (i === -1) return { error: 'Esa solicitud no existe.' };
  if (lista[i].usuario !== usuario) return { error: 'No es tuya.' };
  if (!editable(lista[i])) return { error: 'Ya fue resuelta: no se puede editar.' };

  const error = validar({ ...lista[i], ...datos });
  if (error) return { error };

  const copia = [...lista];
  copia[i] = {
    ...copia[i],
    tipo: datos.tipo ?? copia[i].tipo,
    inicio: datos.inicio ?? copia[i].inicio,
    fin: datos.fin ?? copia[i].fin,
    motivo: (datos.motivo ?? copia[i].motivo).trim().slice(0, MAX_MOTIVO),
  };
  await guardar(LICENCIAS, copia);
  return { solicitud: copia[i] };
}

/** Pasa un borrador a enviada. Ya enviada, no hace nada. */
export async function enviar(id, usuario) {
  const lista = await leer(LICENCIAS);
  const i = lista.findIndex((s) => s.id === id);
  if (i === -1) return { error: 'Esa solicitud no existe.' };
  if (lista[i].usuario !== usuario) return { error: 'No es tuya.' };
  if (lista[i].estado !== 'borrador') return { error: 'Esta solicitud ya fue enviada.' };

  const copia = [...lista];
  copia[i] = { ...copia[i], estado: 'enviada', enviado: new Date().toISOString() };
  await guardar(LICENCIAS, copia);
  return { solicitud: copia[i] };
}

/** Borrar: el dueño mientras no esté resuelta; el administrador, cualquiera. */
export async function borrar(id, usuario, admin) {
  const lista = await leer(LICENCIAS);
  const s = lista.find((x) => x.id === id);
  if (!s) return { error: 'Esa solicitud no existe.' };
  if (!admin) {
    if (s.usuario !== usuario) return { error: 'No es tuya.' };
    if (!editable(s)) return { error: 'Ya fue resuelta: no se puede borrar.' };
  }
  await guardar(LICENCIAS, lista.filter((x) => x.id !== id));
  return { ok: true, solicitud: s };
}

/** Decisión del administrador. `estado` debe ser 'aprobada' o 'rechazada'. */
export async function resolver(id, estado, respuesta, porQuien) {
  if (!['aprobada', 'rechazada'].includes(estado)) {
    return { error: 'Decisión no válida.' };
  }

  const lista = await leer(LICENCIAS);
  const i = lista.findIndex((s) => s.id === id);
  if (i === -1) return { error: 'Esa solicitud no existe.' };
  if (lista[i].estado === 'borrador') {
    return { error: 'Todavía es un borrador de su autor.' };
  }

  const copia = [...lista];
  copia[i] = {
    ...copia[i],
    estado,
    respuesta: typeof respuesta === 'string' ? respuesta.trim().slice(0, MAX_RESPUESTA) : null,
    resuelto: new Date().toISOString(),
    resueltoPor: porQuien,
  };
  await guardar(LICENCIAS, copia);
  return { solicitud: copia[i] };
}
