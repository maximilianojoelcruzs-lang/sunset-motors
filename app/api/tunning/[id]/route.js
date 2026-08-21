import { NextResponse } from 'next/server';
import { exigirTaller } from '../../../../lib/servidor';
import { agregar, borrar, cerrar, marcar, quitar } from '../../../../lib/tunning';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * PATCH /api/tunning/:id
 *
 *   { agregar: pieza | [piezas] }                 añade una pieza o el pedido entero
 *   { pieza, hecha }                              marca o desmarca
 *   { quitar }                                    saca una pieza
 *   { cerrado }                                   cierra o reabre el pedido
 */
export async function PATCH(peticion, { params }) {
  const { sesion, corte } = await exigirTaller();
  if (corte) return corte;

  const { id } = await params;
  const cambios = await peticion.json().catch(() => ({}));

  try {
    let resultado;

    // El usuario va en todas: un pedido solo lo toca quien lo abrió, y eso se comprueba en el
    // servidor. Filtrar la lista no basta — el identificador se puede mandar a mano.
    const quien = sesion.usuario;

    if (cambios.agregar) resultado = await agregar(id, quien, cambios.agregar);
    else if (cambios.quitar) resultado = await quitar(id, quien, cambios.quitar);
    else if (cambios.pieza) resultado = await marcar(id, quien, cambios.pieza, cambios.hecha);
    else if (typeof cambios.cerrado === 'boolean')
      resultado = await cerrar(id, quien, cambios.cerrado);
    else return NextResponse.json({ error: 'Nada que cambiar.' }, { status: 400 });

    if (resultado.error) return NextResponse.json({ error: resultado.error }, { status: 400 });
    return NextResponse.json({ pedido: resultado.pedido });
  } catch (e) {
    return NextResponse.json({ error: `No se pudo guardar: ${e.message}` }, { status: 500 });
  }
}

export async function DELETE(peticion, { params }) {
  const { sesion, corte } = await exigirTaller();
  if (corte) return corte;

  const { id } = await params;

  try {
    const { error } = await borrar(id, sesion.usuario);
    if (error) return NextResponse.json({ error }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: `No se pudo borrar: ${e.message}` }, { status: 500 });
  }
}
