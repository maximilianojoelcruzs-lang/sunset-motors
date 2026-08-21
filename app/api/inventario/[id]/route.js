import { NextResponse } from 'next/server';
import { exigirTaller } from '../../../../lib/servidor';
import { borrar, corregir, listar } from '../../../../lib/inventario';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * PATCH /api/inventario/:id  body: { nombre?, cantidad? }
 *
 * Corregir a mano no es un lujo: el juego enseña los nombres largos cortados —«KIT DE
 * REPARACI…»— y alguien tiene que poder escribir el nombre entero una vez. También sirve
 * cuando el lector de la captura se equivoca en un dígito.
 */
export async function PATCH(peticion, { params }) {
  const { corte } = await exigirTaller();
  if (corte) return corte;

  const { id } = await params;
  const cambios = await peticion.json().catch(() => ({}));

  try {
    const { error, articulo } = await corregir(id, cambios);
    if (error) return NextResponse.json({ error }, { status: 400 });
    return NextResponse.json({ articulo });
  } catch (e) {
    return NextResponse.json({ error: `No se pudo guardar: ${e.message}` }, { status: 500 });
  }
}

export async function DELETE(peticion, { params }) {
  const { corte } = await exigirTaller();
  if (corte) return corte;

  const { id } = await params;

  try {
    const { error } = await borrar(id);
    if (error) return NextResponse.json({ error }, { status: 400 });
    return NextResponse.json({ ok: true, articulos: await listar() });
  } catch (e) {
    return NextResponse.json({ error: `No se pudo borrar: ${e.message}` }, { status: 500 });
  }
}
