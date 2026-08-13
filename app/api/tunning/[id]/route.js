import { NextResponse } from 'next/server';
import { sesionActual } from '../../../../lib/servidor';
import { esAdmin, soloCasino } from '../../../../lib/usuarios';
import { agregar, borrar, cerrar, marcar, quitar } from '../../../../lib/tunning';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function exigirTaller() {
  const sesion = await sesionActual();
  if (!sesion) return { corte: NextResponse.json({ error: 'Sin sesión.' }, { status: 401 }) };
  if (await soloCasino(sesion.usuario)) {
    return { corte: NextResponse.json({ error: 'No autorizado.' }, { status: 403 }) };
  }
  return { sesion };
}

/**
 * PATCH /api/tunning/:id
 *
 *   { agregar: { categoria, etiqueta, valor } }   añade una pieza
 *   { pieza, hecha }                              marca o desmarca
 *   { quitar }                                    saca una pieza
 *   { cerrado }                                   cierra o reabre el pedido
 */
export async function PATCH(peticion, { params }) {
  const { corte } = await exigirTaller();
  if (corte) return corte;

  const { id } = await params;
  const cambios = await peticion.json().catch(() => ({}));

  try {
    let resultado;

    if (cambios.agregar) resultado = await agregar(id, cambios.agregar);
    else if (cambios.quitar) resultado = await quitar(id, cambios.quitar);
    else if (cambios.pieza) resultado = await marcar(id, cambios.pieza, cambios.hecha);
    else if (typeof cambios.cerrado === 'boolean') resultado = await cerrar(id, cambios.cerrado);
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
    const { error } = await borrar(id, sesion.usuario, await esAdmin(sesion.usuario));
    if (error) return NextResponse.json({ error }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: `No se pudo borrar: ${e.message}` }, { status: 500 });
  }
}
