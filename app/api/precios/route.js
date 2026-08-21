import { NextResponse } from 'next/server';
import { exigirAdmin, exigirTaller } from '../../../lib/servidor';
import { obtener, reemplazar, restaurarSemilla } from '../../../lib/precios';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/precios → el catálogo. Lo necesita cualquiera para calcular. */
export async function GET() {
  const { sesion, corte } = await exigirTaller();
  if (corte) return corte;

  try {
    return NextResponse.json({ catalogo: await obtener() });
  } catch (e) {
    return NextResponse.json({ error: `No se pudo leer: ${e.message}` }, { status: 500 });
  }
}

/** PUT /api/precios  body: { secciones }. Solo administradores. */
export async function PUT(peticion) {
  const { sesion, corte } = await exigirAdmin();
  if (corte) return corte;

  const { secciones } = await peticion.json().catch(() => ({}));

  try {
    const { error, catalogo } = await reemplazar(secciones, sesion.usuario);
    if (error) return NextResponse.json({ error }, { status: 400 });
    return NextResponse.json({ catalogo });
  } catch (e) {
    return NextResponse.json({ error: `No se pudo guardar: ${e.message}` }, { status: 500 });
  }
}

/** POST /api/precios → volver al catálogo original del código. Solo administradores. */
export async function POST() {
  const { sesion, corte } = await exigirAdmin();
  if (corte) return corte;

  try {
    const { catalogo } = await restaurarSemilla(sesion.usuario);
    return NextResponse.json({ catalogo });
  } catch (e) {
    return NextResponse.json({ error: `No se pudo restaurar: ${e.message}` }, { status: 500 });
  }
}
