import { NextResponse } from 'next/server';
import { exigirAdmin } from '../../../../lib/servidor';
import { alternar, borrar, editar } from '../../../../lib/popups';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * PATCH /api/popups/:id
 *
 *   { titulo, texto, imagen, hasta }  cambia el contenido o el tiempo límite
 *   { activo: false }                 lo apaga sin borrarlo
 */
export async function PATCH(peticion, { params }) {
  const { corte } = await exigirAdmin();
  if (corte) return corte;

  const { id } = await params;
  const cambios = await peticion.json().catch(() => ({}));

  try {
    const resultado =
      typeof cambios.activo === 'boolean'
        ? await alternar(id, cambios.activo)
        : await editar(id, cambios);

    if (resultado.error) return NextResponse.json({ error: resultado.error }, { status: 400 });
    return NextResponse.json({ popup: resultado.popup });
  } catch (e) {
    return NextResponse.json({ error: `No se pudo guardar: ${e.message}` }, { status: 500 });
  }
}

export async function DELETE(peticion, { params }) {
  const { corte } = await exigirAdmin();
  if (corte) return corte;

  const { id } = await params;

  try {
    const { error } = await borrar(id);
    if (error) return NextResponse.json({ error }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: `No se pudo borrar: ${e.message}` }, { status: 500 });
  }
}
