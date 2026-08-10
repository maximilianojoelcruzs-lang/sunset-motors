// Lectura de la sesión desde componentes y route handlers.
//
// Va aparte de lib/sesion.js a propósito: aquel lo importa el middleware, que corre en Edge
// y no tiene `next/headers`. Mezclarlos rompe el build del middleware.

import { cookies } from 'next/headers';
import { COOKIE, leerSesion } from './sesion.js';

export async function sesionActual() {
  const almacen = await cookies();
  return leerSesion(almacen.get(COOKIE)?.value);
}
