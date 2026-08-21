import { NextResponse } from 'next/server';
import { exigirAdmin } from '../../../../lib/servidor';
import { borrarFlyer, renombrarFlyer } from '../../../../lib/anuncios';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** PATCH /api/flyers/:id  body: { titulo } */
export async function PATCH(peticion, { params }) {
  const { corte } = await exigirAdmin();
  if (corte) return corte;

  const { id } = await params;
  const { titulo } = await peticion.json().catch(() => ({}));

  try {
    const { error, flyer } = await renombrarFlyer(id, titulo);
    if (error) return NextResponse.json({ error }, { status: 400 });
    return NextResponse.json({ flyer });
  } catch (e) {
    return NextResponse.json({ error: `No se pudo guardar: ${e.message}` }, { status: 500 });
  }
}

export async function DELETE(peticion, { params }) {
  const { corte } = await exigirAdmin();
  if (corte) return corte;

  const { id } = await params;

  try {
    const { error } = await borrarFlyer(id);
    if (error) return NextResponse.json({ error }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: `No se pudo borrar: ${e.message}` }, { status: 500 });
  }
}
