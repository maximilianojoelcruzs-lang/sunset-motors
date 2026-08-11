import { NextResponse } from 'next/server';
import { sesionActual } from '../../../lib/servidor';
import { esAdmin } from '../../../lib/usuarios';
import { crear, listar, listarEnviadas } from '../../../lib/licencias';
import { crearAviso, ADMINS } from '../../../lib/avisos';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/licencias        → las propias
 * GET /api/licencias?todas=1 → todas las enviadas, solo administradores
 *
 * Los borradores ajenos no salen nunca: son de quien los escribe hasta que los envía.
 */
export async function GET(peticion) {
  const sesion = await sesionActual();
  if (!sesion) return NextResponse.json({ error: 'Sin sesión.' }, { status: 401 });

  const quiereTodas = peticion.nextUrl.searchParams.get('todas') === '1';
  const admin = await esAdmin(sesion.usuario);

  if (quiereTodas && !admin) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });
  }

  try {
    return NextResponse.json({
      solicitudes: quiereTodas ? await listarEnviadas() : await listar(sesion.usuario),
      usuario: sesion.usuario,
      admin,
    });
  } catch (e) {
    return NextResponse.json({ error: `No se pudo leer: ${e.message}` }, { status: 500 });
  }
}

/** POST /api/licencias  body: { tipo, inicio, fin, motivo, enviar } */
export async function POST(peticion) {
  const sesion = await sesionActual();
  if (!sesion) return NextResponse.json({ error: 'Sin sesión.' }, { status: 401 });

  const datos = await peticion.json().catch(() => ({}));

  try {
    const { error, solicitud } = await crear(sesion.usuario, datos);
    if (error) return NextResponse.json({ error }, { status: 400 });

    if (solicitud.estado === 'enviada') {
      await crearAviso({
        para: ADMINS,
        texto: `${sesion.usuario} pidió ${solicitud.tipo} del ${solicitud.inicio} al ${solicitud.fin}.`,
        enlace: '/licencias',
      });
    }

    return NextResponse.json({ solicitud });
  } catch (e) {
    return NextResponse.json({ error: `No se pudo guardar: ${e.message}` }, { status: 500 });
  }
}
