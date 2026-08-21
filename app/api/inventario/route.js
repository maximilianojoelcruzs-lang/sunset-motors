import { NextResponse } from 'next/server';
import { exigirTaller } from '../../../lib/servidor';
import { aplicar, listar, listarCargas } from '../../../lib/inventario';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const { corte } = await exigirTaller();
  if (corte) return corte;

  try {
    const [articulos, cargas] = await Promise.all([listar(), listarCargas()]);
    return NextResponse.json({ articulos, cargas });
  } catch (e) {
    return NextResponse.json({ error: `No se pudo leer: ${e.message}` }, { status: 500 });
  }
}

/**
 * POST /api/inventario  body: { filas: [{ nombre, peso, cantidad }] }
 *
 * Llegan **ya confirmadas por una persona**: la pantalla enseña la comparación y recién después
 * manda. El servidor vuelve a comparar de todos modos, porque entre que se miró la tabla y se
 * pulsó el botón alguien más pudo haber cargado otra captura.
 */
export async function POST(peticion) {
  const { sesion, corte } = await exigirTaller();
  if (corte) return corte;

  const { filas } = await peticion.json().catch(() => ({}));
  if (!Array.isArray(filas) || !filas.length) {
    return NextResponse.json({ error: 'No llegó ninguna fila.' }, { status: 400 });
  }

  try {
    const resultado = await aplicar(sesion.usuario, filas);
    if (resultado.error) return NextResponse.json({ error: resultado.error }, { status: 400 });
    return NextResponse.json({ ...resultado, articulos: await listar() });
  } catch (e) {
    return NextResponse.json({ error: `No se pudo guardar: ${e.message}` }, { status: 500 });
  }
}
