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

import { cambiar, leer, modificar } from './almacen.js';

export const AVISOS = 'sunset:avisos';
export const ADMINS = '@admins';

const MAXIMO = 400; // Se conservan los más recientes; el resto se descarta.

export async function crearAviso({ para, texto, enlace = null }) {
  const aviso = {
    id: crypto.randomUUID(),
    para,
    texto,
    enlace,
    leido: false,
    creado: new Date().toISOString(),
  };
  // Por `modificar` y no con leer+guardar: dos avisos que caen en el mismo instante —un cierre
  // automático mientras alguien marca leído— se pisaban, y el segundo en guardar borraba al
  // primero. Es el mismo fallo que se arregló en los turnos.
  await modificar(AVISOS, (lista) => ({ lista: [aviso, ...lista].slice(0, MAXIMO), hecho: true }));
  return aviso;
}

/** Varios avisos de una sola escritura, para no leer y guardar la lista dos veces. */
export async function crearAvisos(varios) {
  if (!varios.length) return;
  const nuevos = varios.map((a) => ({
    id: crypto.randomUUID(),
    para: a.para,
    texto: a.texto,
    enlace: a.enlace ?? null,
    leido: false,
    creado: new Date().toISOString(),
  }));
  await modificar(AVISOS, (lista) => ({
    lista: [...nuevos, ...lista].slice(0, MAXIMO),
    hecho: true,
  }));
}

/**
 * ¿Este aviso es para esta persona? Puro: el `admin` **se recibe**, no se consulta.
 *
 * Antes preguntaba `esAdmin(usuario)` aquí dentro, y esto se llama una vez por aviso: con la
 * lista llena de avisos a ADMINS eran hasta 400 lecturas de la tabla de usuarios **en una sola
 * petición**, y la campanita pregunta cada 20 segundos. Quien llama ya sabe si es admin: el
 * portero de la ruta lo leyó al comprobar la sesión.
 */
const leGusta = (aviso, usuario, admin) =>
  aviso.para === usuario || (aviso.para === ADMINS && admin);

/** Lo escondió a mano quien lo mira. Solo pasa con los avisos a ADMINS (ver `borrar`). */
const escondido = (aviso, usuario) => (aviso.ocultoPor ?? []).includes(usuario);

/** Avisos de una persona, más reciente primero. Los que borró no vuelven. */
export async function avisosDe(usuario, admin = false) {
  const lista = await leer(AVISOS);
  return lista.filter((aviso) => leGusta(aviso, usuario, admin) && !escondido(aviso, usuario));
}

/**
 * Marca como leídos. Los dirigidos a ADMINS no se pueden marcar así sin más: si un admin
 * los marcara, desaparecerían para los demás. Esos se guardan por persona en `leidoPor`.
 */
export async function marcarLeidos(usuario, admin = false) {
  await modificar(AVISOS, (lista) => ({
    lista: lista.map((a) => {
      if (a.para === usuario) return { ...a, leido: true };
      // Solo si de verdad es admin: si no, se apuntaba en el `leidoPor` de avisos que esa
      // persona no puede ni ver.
      if (a.para === ADMINS && admin) {
        const leidoPor = a.leidoPor ?? [];
        return leidoPor.includes(usuario) ? a : { ...a, leidoPor: [...leidoPor, usuario] };
      }
      return a;
    }),
    hecho: true,
  }));
}

/** Un aviso está leído para alguien si es suyo y está leído, o si está en leidoPor. */
export const estaLeido = (aviso, usuario) =>
  aviso.para === ADMINS ? (aviso.leidoPor ?? []).includes(usuario) : aviso.leido;

/**
 * Borra un aviso, o todos los de quien pide (`id = null`).
 *
 * **Un aviso propio se borra de verdad; uno a ADMINS solo se esconde** para quien lo borra,
 * en `ocultoPor`. Borrar la fila de un aviso compartido se lo quitaría de la campanita a los
 * demás administradores, que no han pedido nada — es el mismo motivo por el que `leidoPor`
 * existe en vez de un `leido` suelto.
 *
 * Los que no le corresponden a esta persona no se tocan nunca: el identificador se puede
 * mandar a mano, así que la comprobación va en el servidor y no en la pantalla.
 */
export async function borrar(usuario, { id = null, admin = false } = {}) {
  const mio = (a) => leGusta(a, usuario, admin) && !escondido(a, usuario);
  const elegido = (a) => (id === null ? mio(a) : a.id === id && mio(a));

  const resultado = await cambiar(AVISOS, (lista) => {
    if (id !== null && !lista.some((a) => a.id === id)) {
      return { error: 'Ese aviso no existe.' };
    }
    if (id !== null && !lista.some(elegido)) return { error: 'Ese aviso no es tuyo.' };

    let borrados = 0;
    const siguiente = [];

    for (const a of lista) {
      if (!elegido(a)) {
        siguiente.push(a);
        continue;
      }
      borrados += 1;
      // Compartido: se esconde para quien borra y sigue ahí para el resto.
      if (a.para === ADMINS) {
        siguiente.push({ ...a, ocultoPor: [...(a.ocultoPor ?? []), usuario] });
      }
    }

    if (!borrados) return { lista: null, valor: { borrados: 0 } };
    return { lista: siguiente, valor: { borrados } };
  });

  if (resultado.error) return resultado;
  return { borrados: resultado.borrados ?? 0 };
}
