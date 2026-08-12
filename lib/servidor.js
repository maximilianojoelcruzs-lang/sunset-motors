// Lectura de la sesión desde componentes y route handlers.
//
// Va aparte de lib/sesion.js a propósito: aquel lo importa el middleware, que corre en Edge
// y no tiene `next/headers`. Mezclarlos rompe el build del middleware.

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { COOKIE, leerSesion } from './sesion.js';
import { accesosDe, soloCasino } from './usuarios.js';

export { accesosDe };

export async function sesionActual() {
  const almacen = await cookies();
  return leerSesion(almacen.get(COOKIE)?.value);
}

/**
 * Sesión para las páginas del taller. Devuelve el usuario, o corta el paso:
 *
 *   sin sesión           -> al login
 *   solo casino          -> al casino
 *
 * Va acá y no en el middleware porque el rol se consulta contra la base, y el middleware
 * corre en Edge. Toda página del taller debe empezar por esta línea: si alguna se la salta,
 * un invitado del casino termina viendo la calculadora del taller.
 */
export async function sesionDeTaller() {
  const sesion = await sesionActual();
  if (!sesion) redirect('/login');
  if (await soloCasino(sesion.usuario)) redirect('/casino');
  return sesion;
}
