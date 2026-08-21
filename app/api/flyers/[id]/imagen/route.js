import { NextResponse } from 'next/server';
import { exigirTaller } from '../../../../../lib/servidor';
import { flyerPorId } from '../../../../../lib/anuncios';
import { urlFirmada } from '../../../../../lib/imagenes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/flyers/:id/imagen → redirige a la imagen firmada.
 *
 * Un flyer es para todo el taller, así que basta con tener sesión — no como las capturas de
 * devoluciones, que son de su dueño. Pero sigue pasando por acá y no por una URL pública:
 * el bucket es privado y estos flyers son material interno del taller, no de internet.
 */
export async function GET(peticion, { params }) {
  const { sesion, corte } = await exigirTaller();
  if (corte) return corte;

  const { id } = await params;
  const flyer = await flyerPorId(id);
  if (!flyer?.imagen) return NextResponse.json({ error: 'No existe.' }, { status: 404 });

  // Una hora: los flyers se miran en galería y se vuelven a abrir; firmarlos cada 5 minutos
  // haría que la pestaña abierta se quedara con imágenes rotas.
  const { url, error } = await urlFirmada(flyer.imagen, 3600);
  if (error) return NextResponse.json({ error }, { status: 500 });

  return NextResponse.redirect(new URL(url, peticion.nextUrl.origin));
}
