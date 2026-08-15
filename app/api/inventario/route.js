import { NextResponse } from 'next/server';
import { sesionActual } from '../../../lib/servidor';
import { soloCasino } from '../../../lib/usuarios';
import { aplicar, listar, listarCargas } from '../../../lib/inventario';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * El inventario es del taller entero, y lo actualiza cualquiera con cuenta de taller.
 *
 * A diferencia de los pedidos de tunning —que son de quien los abre—, acá la bodega es una
 * sola: si cada uno tuviera su inventario, no habría inventario. Un invitado del casino no
 * entra, como en el resto de la API del taller.
 */
async function exigirTaller() {
  const sesion = await sesionActual();
  if (!sesion) return { corte: NextResponse.json({ error: 'Sin sesión.' }, { status: 401 }) };
  if (await soloCasino(sesion.usuario)) {
    return { corte: NextResponse.json({ error: 'No autorizado.' }, { status: 403 }) };
  }
  return { sesion };
}

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
