import { NextResponse } from 'next/server';
import { exigirSesion } from '../../../../lib/servidor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TIPOS = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  pdf: 'application/pdf',
};

/**
 * Sirve las imágenes cuando NO hay Supabase, es decir, en desarrollo. En producción esta
 * ruta no se usa: ahí las imágenes vienen firmadas desde Supabase Storage.
 *
 * Exige sesión igual, y comprueba que la ruta no se salga de .datos/imagenes: sin eso, un
 * "../../" en la URL dejaría leer cualquier archivo del servidor.
 */
export async function GET(peticion, { params }) {
  const { sesion, corte } = await exigirSesion();
  if (corte) return corte;

  const { ruta } = await params;
  const relativa = (ruta ?? []).join('/');

  if (!/^[a-z0-9/_-]+\.(jpg|png|webp|pdf)$/i.test(relativa) || relativa.includes('..')) {
    return NextResponse.json({ error: 'Ruta no válida.' }, { status: 400 });
  }

  try {
    const { readFile } = await import('node:fs/promises');
    const { resolve } = await import('node:path');

    const base = resolve('.datos/imagenes');
    const destino = resolve(base, relativa);
    if (!destino.startsWith(base)) {
      return NextResponse.json({ error: 'Ruta no válida.' }, { status: 400 });
    }

    const datos = await readFile(destino);
    const extension = relativa.split('.').pop().toLowerCase();
    return new NextResponse(datos, {
      headers: { 'Content-Type': TIPOS[extension], 'Cache-Control': 'private, max-age=60' },
    });
  } catch {
    return NextResponse.json({ error: 'No existe.' }, { status: 404 });
  }
}
