import { NextResponse } from 'next/server';
import { sesionActual } from '../../../../../lib/servidor';
import { porId } from '../../../../../lib/documentos';
import { urlFirmada } from '../../../../../lib/imagenes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/documentos/:id/archivo → redirige al archivo firmado.
 *
 * Basta con tener sesión: un reglamento es para todo el taller. Pero sigue pasando por acá
 * y no por una URL pública, porque el bucket es privado y estos documentos —contratos,
 * acuerdos— son material interno.
 *
 * Una hora de validez: un PDF se abre, se lee un rato y se vuelve a mirar.
 */
export async function GET(peticion, { params }) {
  const sesion = await sesionActual();
  if (!sesion) return NextResponse.json({ error: 'Sin sesión.' }, { status: 401 });

  const { id } = await params;
  const documento = await porId(id);
  if (!documento?.archivo) return NextResponse.json({ error: 'No existe.' }, { status: 404 });

  const { url, error } = await urlFirmada(documento.archivo, 3600);
  if (error) return NextResponse.json({ error }, { status: 500 });

  return NextResponse.redirect(new URL(url, peticion.nextUrl.origin));
}
