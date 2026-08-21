// Freno a los intentos de entrar a lo bruto.
//
// El taller entero está detrás de una clave, y hasta ahora se podía probar claves **sin
// ningún límite**: con un script y una lista de claves comunes, una cuenta con clave corta
// cae en minutos y nadie se enteraría, porque no queda rastro de los fallos en ninguna parte.
//
// No hay captcha ni servicio externo: se cuentan los fallos en el mismo almacén de siempre.

import { leer, modificar } from './almacen.js';

const INTENTOS = 'sunset:intentos';

/** A partir de cuántos fallos se empieza a hacer esperar, por cuenta y equipo. */
const LIBRES = 5;

/**
 * Y a partir de cuántos por equipo, contando todas las cuentas que haya probado.
 *
 * Es más alto porque un equipo compartido —el mismo taller, una casa— tiene varias cuentas
 * legítimas equivocándose. Pero sirve para lo que importa: quien prueba una lista de usuarios
 * uno tras otro choca acá aunque falle poco con cada uno.
 */
const LIBRES_EQUIPO = 15;

/** La espera se dobla con cada fallo, hasta este tope. Media hora ya no la aguanta un script. */
const ESPERA_MAXIMA = 1800;

/** Un fallo de hace rato no cuenta: si no, un despiste de la semana pasada bloquea hoy. */
const OLVIDA_MS = 60 * 60 * 1000;

const claveCuenta = (usuario, equipo) => `u:${String(usuario).trim().toLowerCase()}|${equipo}`;
const claveEquipo = (equipo) => `ip:${equipo}`;

/** Segundos de espera que le tocan a quien ya falló `fallos` veces. */
const esperaDe = (fallos, libres) =>
  fallos <= libres ? 0 : Math.min(ESPERA_MAXIMA, 15 * 2 ** (fallos - libres - 1));

/**
 * De dónde viene la petición. En Vercel el primer salto de `x-forwarded-for` es el cliente;
 * el resto de la cadena la pone el propio proxy y no se puede falsear desde fuera.
 */
export function equipoDe(peticion) {
  const cadena = peticion.headers.get('x-forwarded-for') ?? '';
  const primero = cadena.split(',')[0].trim();
  return primero || peticion.headers.get('x-real-ip') || 'sin-equipo';
}

const vivos = (lista, ahora) =>
  (Array.isArray(lista) ? lista : []).filter((e) => ahora - (e.visto ?? 0) < OLVIDA_MS);

/**
 * ¿Puede intentar? Devuelve `{ ok }` o `{ ok: false, segundos }`.
 *
 * Se consulta **antes** de comprobar la clave: la idea es no llegar nunca a comprobarla.
 */
export async function puedeIntentar(usuario, equipo) {
  const ahora = Date.now();
  const lista = vivos(await leer(INTENTOS), ahora);

  const mira = (clave, libres) => {
    const entrada = lista.find((e) => e.clave === clave);
    if (!entrada) return 0;
    const espera = esperaDe(entrada.fallos, libres);
    const restan = Math.ceil((entrada.visto + espera * 1000 - ahora) / 1000);
    return restan > 0 ? restan : 0;
  };

  const segundos = Math.max(
    mira(claveCuenta(usuario, equipo), LIBRES),
    mira(claveEquipo(equipo), LIBRES_EQUIPO)
  );

  return segundos > 0 ? { ok: false, segundos } : { ok: true };
}

/** Anota un fallo, para la cuenta y para el equipo. */
export async function anotarFallo(usuario, equipo) {
  const ahora = Date.now();
  const claves = [claveCuenta(usuario, equipo), claveEquipo(equipo)];

  await modificar(INTENTOS, (lista) => {
    // La poda va acá y no en un proceso aparte: esta app no tiene ninguno, y así la colección
    // no crece para siempre con equipos que pasaron una vez.
    const limpia = vivos(lista, ahora);
    for (const clave of claves) {
      const i = limpia.findIndex((e) => e.clave === clave);
      if (i === -1) limpia.push({ clave, fallos: 1, visto: ahora });
      else limpia[i] = { ...limpia[i], fallos: limpia[i].fallos + 1, visto: ahora };
    }
    return { lista: limpia, hecho: true };
  });
}

/**
 * Entró bien: se borra su cuenta del contador.
 *
 * El del equipo **no** se borra. Si se borrara, bastaría con tener una cuenta propia y entrar
 * con ella de vez en cuando para dejar el contador del equipo en cero y seguir probando.
 */
export async function olvidarFallos(usuario, equipo) {
  const clave = claveCuenta(usuario, equipo);
  await modificar(INTENTOS, (lista) => {
    const limpia = vivos(lista, Date.now());
    const quedan = limpia.filter((e) => e.clave !== clave);
    if (quedan.length === (Array.isArray(lista) ? lista.length : 0)) return null;
    return { lista: quedan, hecho: true };
  });
}
