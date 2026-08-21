import { NextResponse } from 'next/server';
import { exigirSesion } from '../../../lib/servidor';
import { avisosDe, borrar, estaLeido, marcarLeidos } from '../../../lib/avisos';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/avisos → los avisos de quien pide, con la cuenta de no leídos. */
export async function GET() {
  const { sesion, accesos, corte } = await exigirSesion();
  if (corte) return corte;

  try {
    const avisos = await avisosDe(sesion.usuario, accesos.admin);
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
  const { sesion, accesos, corte } = await exigirSesion();
  if (corte) return corte;

  try {
    await marcarLeidos(sesion.usuario, accesos.admin);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: `No se pudo guardar: ${e.message}` }, { status: 500 });
  }
}

/**
 * DELETE /api/avisos          → borra todos los de quien pide
 * DELETE /api/avisos?id=xxx   → borra uno
 *
 * Va en la misma ruta y no en `/api/avisos/[id]` porque las dos hacen lo mismo con el mismo
 * chequeo; el identificador es lo único que cambia. Nadie puede borrar el aviso de otro: la
 * comprobación está en `lib/avisos.js`, contra la lista de verdad.
 */
export async function DELETE(peticion) {
  const { sesion, accesos, corte } = await exigirSesion();
  if (corte) return corte;

  const id = peticion.nextUrl.searchParams.get('id');

  try {
    const { error, borrados } = await borrar(sesion.usuario, { id, admin: accesos.admin });
    if (error) return NextResponse.json({ error }, { status: 400 });
    return NextResponse.json({ ok: true, borrados });
  } catch (e) {
    return NextResponse.json({ error: `No se pudo borrar: ${e.message}` }, { status: 500 });
  }
}
