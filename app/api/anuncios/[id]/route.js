import { NextResponse } from 'next/server';
import { exigirAdmin } from '../../../../lib/servidor';
import { borrarMensaje, editarMensaje } from '../../../../lib/anuncios';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** PATCH /api/anuncios/:id  body: { titulo, texto } */
export async function PATCH(peticion, { params }) {
  const { corte } = await exigirAdmin();
  if (corte) return corte;

  const { id } = await params;
  const datos = await peticion.json().catch(() => ({}));

  try {
    const { error, mensaje } = await editarMensaje(id, datos);
    if (error) return NextResponse.json({ error }, { status: 400 });
    return NextResponse.json({ mensaje });
  } catch (e) {
    return NextResponse.json({ error: `No se pudo guardar: ${e.message}` }, { status: 500 });
  }
}

export async function DELETE(peticion, { params }) {
  const { corte } = await exigirAdmin();
  if (corte) return corte;

  const { id } = await params;

  try {
    const { error } = await borrarMensaje(id);
    if (error) return NextResponse.json({ error }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: `No se pudo borrar: ${e.message}` }, { status: 500 });
  }
}
