import { NextResponse } from 'next/server';
import { sesionActual } from '../../../lib/servidor';
import { avisosDe, estaLeido, marcarLeidos } from '../../../lib/avisos';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/avisos → los avisos de quien pide, con la cuenta de no leídos. */
export async function GET() {
  const sesion = await sesionActual();
  if (!sesion) return NextResponse.json({ error: 'Sin sesión.' }, { status: 401 });

  try {
    const avisos = await avisosDe(sesion.usuario);
    return NextResponse.json({
      avisos: avisos.slice(0, 40).map((a) => ({
        id: a.id,
        texto: a.texto,
        enlace: a.enlace,
        creado: a.creado,
        leido: estaLeido(a, sesion.usuario),
      })),
      sinLeer: avisos.filter((a) => !estaLeido(a, sesion.usuario)).length,
    });
  } catch (e) {
    return NextResponse.json({ error: `No se pudo leer: ${e.message}` }, { status: 500 });
  }
}

/** POST /api/avisos → marcar todos los propios como leídos. */
export async function POST() {
  const sesion = await sesionActual();
  if (!sesion) return NextResponse.json({ error: 'Sin sesión.' }, { status: 401 });

  try {
    await marcarLeidos(sesion.usuario);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: `No se pudo guardar: ${e.message}` }, { status: 500 });
  }
}
