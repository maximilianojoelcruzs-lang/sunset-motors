import { NextResponse } from 'next/server';
import { sesionActual } from '../../../../../lib/servidor';
import { esAdmin } from '../../../../../lib/usuarios';
import { entregar, porId, rechazar } from '../../../../../lib/retiros';
import { crearAviso } from '../../../../../lib/avisos';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * PATCH /api/casino/retiros/:id  body: { estado: 'entregado'|'rechazado', motivo }
 *
 * Resolver es solo del administrador: es quien entrega el dinero dentro del juego. Se
 * comprueba acá y no escondiendo el botón.
 */
export async function PATCH(peticion, { params }) {
  const sesion = await sesionActual();
  if (!sesion) return NextResponse.json({ error: 'Sin sesión.' }, { status: 401 });
  if (!(await esAdmin(sesion.usuario))) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });
  }

  const { id } = await params;
  const { estado, motivo } = await peticion.json().catch(() => ({}));

  try {
    const antes = await porId(id);
    if (!antes) return NextResponse.json({ error: 'Esa solicitud no existe.' }, { status: 404 });

    const resultado =
      estado === 'entregado'
        ? await entregar(id, sesion.usuario)
        : estado === 'rechazado'
          ? await rechazar(id, sesion.usuario, motivo)
          : { error: 'Estado desconocido.' };

    if (resultado.error) return NextResponse.json({ error: resultado.error }, { status: 400 });

    // A quien pidió el retiro hay que decirle en qué quedó, sobre todo si le devolvieron
    // las fichas: si no, ve el saldo cambiar y no sabe por qué.
    try {
      await crearAviso({
        para: antes.usuario,
        texto:
          estado === 'entregado'
            ? `Tu retiro de ${antes.fichas.toLocaleString('es-CL')} fichas fue entregado.`
            : `Tu retiro de ${antes.fichas.toLocaleString('es-CL')} fichas fue rechazado. Te devolvimos las fichas.`,
        enlace: '/casino',
      });
    } catch {
      /* la solicitud ya quedó resuelta; el aviso es un extra */
    }

    return NextResponse.json({ retiro: resultado.retiro });
  } catch (e) {
    return NextResponse.json({ error: `No se pudo resolver: ${e.message}` }, { status: 500 });
  }
}
