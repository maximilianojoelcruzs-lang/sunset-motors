// Avisos dentro de la app: la campanita de la barra.
//
//   { id, para, texto, enlace, leido, creado }
//
// `para` es un nombre de usuario, o el comodín ADMINS para avisarle a todos los
// administradores de una vez — quién es admin puede cambiar entre que se crea el aviso y
// que alguien lo lea, así que se resuelve al leer y no al escribir.
//
// No hay correo ni notificación al teléfono: eso necesita un servicio externo. Acá el
// aviso aparece cuando la persona abre la app.

import { leer, guardar } from './almacen.js';
import { esAdmin } from './usuarios.js';

export const AVISOS = 'sunset:avisos';
export const ADMINS = '@admins';

const MAXIMO = 400; // Se conservan los más recientes; el resto se descarta.

export async function crearAviso({ para, texto, enlace = null }) {
  const lista = await leer(AVISOS);
  const aviso = {
    id: crypto.randomUUID(),
    para,
    texto,
    enlace,
    leido: false,
    creado: new Date().toISOString(),
  };
  const siguiente = [aviso, ...lista].slice(0, MAXIMO);
  await guardar(AVISOS, siguiente);
  return aviso;
}

/** Varios avisos de una sola escritura, para no leer y guardar la lista dos veces. */
export async function crearAvisos(varios) {
  if (!varios.length) return;
  const lista = await leer(AVISOS);
  const nuevos = varios.map((a) => ({
    id: crypto.randomUUID(),
    para: a.para,
    texto: a.texto,
    enlace: a.enlace ?? null,
    leido: false,
    creado: new Date().toISOString(),
  }));
  await guardar(AVISOS, [...nuevos, ...lista].slice(0, MAXIMO));
}

const leGusta = async (aviso, usuario) => {
  if (aviso.para === usuario) return true;
  if (aviso.para === ADMINS) return esAdmin(usuario);
  return false;
};

/** Avisos de una persona, más reciente primero. */
export async function avisosDe(usuario) {
  const lista = await leer(AVISOS);
  const mios = [];
  for (const aviso of lista) {
    if (await leGusta(aviso, usuario)) mios.push(aviso);
  }
  return mios;
}

/**
 * Marca como leídos. Los dirigidos a ADMINS no se pueden marcar así sin más: si un admin
 * los marcara, desaparecerían para los demás. Esos se guardan por persona en `leidoPor`.
 */
export async function marcarLeidos(usuario) {
  const lista = await leer(AVISOS);
  const siguiente = lista.map((a) => {
    if (a.para === usuario) return { ...a, leido: true };
    if (a.para === ADMINS) {
      const leidoPor = a.leidoPor ?? [];
      return leidoPor.includes(usuario) ? a : { ...a, leidoPor: [...leidoPor, usuario] };
    }
    return a;
  });
  await guardar(AVISOS, siguiente);
}

/** Un aviso está leído para alguien si es suyo y está leído, o si está en leidoPor. */
export const estaLeido = (aviso, usuario) =>
  aviso.para === ADMINS ? (aviso.leidoPor ?? []).includes(usuario) : aviso.leido;
