// Lectura de la sesión desde componentes y route handlers.
//
// Va aparte de lib/sesion.js a propósito: aquel lo importa el middleware, que corre en Edge
// y no tiene `next/headers`. Mezclarlos rompe el build del middleware.

import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { redirect } from 'next/navigation';
import { COOKIE, leerSesion } from './sesion.js';
import { accesosDe, puertasDe } from './usuarios.js';

export { accesosDe };

export async function sesionActual() {
  const almacen = await cookies();
  return leerSesion(almacen.get(COOKIE)?.value);
}

/**
 * Sesión para las páginas del taller. Devuelve `{ usuario, exp, accesos }`, o corta el paso:
 *
 *   sin sesión           -> al login
 *   cuenta borrada       -> al login
 *   solo casino          -> al casino
 *
 * **Devuelve los accesos ya leídos.** Antes cada página llamaba después a `accesosDe()`, y
 * como las dos consultas leen la misma colección, toda pantalla del taller pedía la tabla de
 * usuarios dos veces por carga — contra Supabase eso son dos idas por la red para lo mismo.
 *
 * El rol se comprueba acá y no en el middleware porque se consulta contra la base, y el
 * middleware corre en Edge. Toda página del taller debe empezar por esta línea: si alguna se
 * la salta, un invitado del casino termina viendo la calculadora.
 */
export async function sesionDeTaller() {
  const sesion = await sesionActual();
  if (!sesion) redirect('/login');

  const puertas = await puertasDe(sesion.usuario);
  // La cuenta ya no está: al login, no al casino. Mandarla al casino sería un rebote infinito,
  // porque de allá tampoco puede entrar.
  if (!puertas.existe) redirect('/login');
  if (!puertas.taller) redirect('/casino');

  const { admin, casino, taller } = puertas;
  return { ...sesion, accesos: { admin, casino, taller } };
}

/** Igual, pero para las páginas del casino. */
export async function sesionDeCasino() {
  const sesion = await sesionActual();
  if (!sesion) redirect('/login');

  const puertas = await puertasDe(sesion.usuario);
  if (!puertas.existe) redirect('/login');
  if (!puertas.casino) redirect('/');

  const { admin, casino, taller } = puertas;
  return { ...sesion, accesos: { admin, casino, taller } };
}

// ---------- Porteros para los route handlers ----------
//
// Cada ruta tenía su propia copia de estas cuatro líneas. Catorce copias es catorce sitios
// donde arreglar un fallo, y de hecho todas arrastraban el mismo: dejaban entrar a una cuenta
// borrada. Acá hay una sola, y da los accesos ya leídos para que la ruta no vuelva a preguntar.

const corte = (mensaje, estado) => ({ corte: NextResponse.json({ error: mensaje }, { status: estado }) });

async function portero(puerta) {
  const sesion = await sesionActual();
  if (!sesion) return corte('Sin sesión.', 401);

  const puertas = await puertasDe(sesion.usuario);
  if (!puertas.existe) return corte('Esta cuenta ya no existe.', 401);
  if (puerta && !puertas[puerta]) return corte('No autorizado.', 403);

  const { admin, casino, taller } = puertas;
  return { sesion, accesos: { admin, casino, taller }, admin };
}

/** Cualquiera con cuenta viva. Para lo que usan las dos vistas: avisos, perfil, clave. */
export const exigirSesion = () => portero(null);

/** Las pantallas del taller. Un invitado del casino no tiene nada que hacer acá. */
export const exigirTaller = () => portero('taller');

/** Las mesas y el top. */
export const exigirCasino = () => portero('casino');

/** Lo que solo abre el encargado. */
export const exigirAdmin = () => portero('admin');
