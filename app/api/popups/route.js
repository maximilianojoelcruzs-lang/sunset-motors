import { NextResponse } from 'next/server';
import { exigirAdmin, exigirSesion } from '../../../lib/servidor';
import { crear, listar, listarVigentes } from '../../../lib/popups';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/popups        → los que hay que mostrar ahora. Cualquiera con cuenta viva.
 * GET /api/popups?todos=1 → todos, también los vencidos. Solo el encargado.
 *
 * Los vencidos y los apagados **no salen** en la versión de cualquiera: si salieran, la
 * pantalla tendría que decidir cuáles mostrar, y esa decisión es del servidor.
 */
export async function GET(peticion) {
  const quiereTodos = peticion.nextUrl.searchParams.get('todos') === '1';
  const { accesos, corte } = quiereTodos ? await exigirAdmin() : await exigirSesion();
  if (corte) return corte;

  try {
    return NextResponse.json({
      popups: quiereTodos ? await listar() : await listarVigentes(),
      admin: Boolean(accesos?.admin),
    });
  } catch (e) {
    return NextResponse.json({ error: `No se pudo leer: ${e.message}` }, { status: 500 });
  }
}

/** POST /api/popups  body: { titulo, texto, imagen, hasta }. Solo administradores. */
export async function POST(peticion) {
  const { sesion, corte } = await exigirAdmin();
  if (corte) return corte;

  const datos = await peticion.json().catch(() => ({}));

  try {
    const { error, popup } = await crear(sesion.usuario, datos);
    if (error) return NextResponse.json({ error }, { status: 400 });
    return NextResponse.json({ popup });
  } catch (e) {
    return NextResponse.json({ error: `No se pudo guardar: ${e.message}` }, { status: 500 });
  }
}
