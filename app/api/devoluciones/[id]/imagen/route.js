import { NextResponse } from 'next/server';
import { sesionActual } from '../../../../../lib/servidor';
import { esAdmin } from '../../../../../lib/usuarios';
import { porId } from '../../../../../lib/devoluciones';
import { urlFirmada } from '../../../../../lib/imagenes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/devoluciones/:id/imagen → redirige a la captura.
 *
 * El bucket es privado a propósito: conocer la ruta de una imagen no alcanza para verla.
 * Se pasa por acá para comprobar quién pregunta, y recién ahí se firma una URL que dura
 * cinco minutos. Una captura del inventario de alguien no tiene por qué quedar colgando en
 * internet para cualquiera que adivine la dirección.
 */
export async function GET(peticion, { params }) {
  const sesion = await sesionActual();
  if (!sesion) return NextResponse.json({ error: 'Sin sesión.' }, { status: 401 });

  const { id } = await params;
  const devolucion = await porId(id);
  if (!devolucion?.imagen) {
    return NextResponse.json({ error: 'No hay imagen.' }, { status: 404 });
  }

  const propia = devolucion.usuario === sesion.usuario;
  if (!propia && !(await esAdmin(sesion.usuario))) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });
  }

  const { url, error } = await urlFirmada(devolucion.imagen, 300);
  if (error) return NextResponse.json({ error }, { status: 500 });

  return NextResponse.redirect(new URL(url, peticion.nextUrl.origin));
}
