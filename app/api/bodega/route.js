import { NextResponse } from 'next/server';
import { sesionActual } from '../../../lib/servidor';
import { esAdmin } from '../../../lib/usuarios';
import { obtener, reemplazar, restaurar } from '../../../lib/bodega';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/bodega → el inventario. Lo mira todo el taller. */
export async function GET() {
  const sesion = await sesionActual();
  if (!sesion) return NextResponse.json({ error: 'Sin sesión.' }, { status: 401 });

  try {
    const bodega = await obtener();
    return NextResponse.json({
      bodega: {
        items: bodega.items,
        actualizado: bodega.actualizado,
        actualizadoPor: bodega.actualizadoPor,
        // Solo si hay algo a lo que volver; el contenido de la versión previa no viaja.
        hayAnterior: Boolean(bodega.anterior),
        anteriorDe: bodega.anterior?.actualizado ?? null,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: `No se pudo leer: ${e.message}` }, { status: 500 });
  }
}

/**
 * PUT /api/bodega  body: { items }
 *
 * Cualquiera con sesión puede actualizar: quien tiene el inventario abierto en el juego es
 * el mecánico, no necesariamente el encargado. La versión anterior queda guardada por si el
 * escaneo salió mal, y el registro dice quién lo dejó así.
 */
export async function PUT(peticion) {
  const sesion = await sesionActual();
  if (!sesion) return NextResponse.json({ error: 'Sin sesión.' }, { status: 401 });

  const { items } = await peticion.json().catch(() => ({}));

  try {
    const { error, bodega } = await reemplazar(items, sesion.usuario);
    if (error) return NextResponse.json({ error }, { status: 400 });
    return NextResponse.json({ bodega });
  } catch (e) {
    return NextResponse.json({ error: `No se pudo guardar: ${e.message}` }, { status: 500 });
  }
}

/** POST /api/bodega → volver a la versión anterior. Solo administradores. */
export async function POST() {
  const sesion = await sesionActual();
  if (!sesion) return NextResponse.json({ error: 'Sin sesión.' }, { status: 401 });
  if (!(await esAdmin(sesion.usuario))) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });
  }

  try {
    const { error, bodega } = await restaurar();
    if (error) return NextResponse.json({ error }, { status: 400 });
    return NextResponse.json({ bodega });
  } catch (e) {
    return NextResponse.json({ error: `No se pudo restaurar: ${e.message}` }, { status: 500 });
  }
}
