import { NextResponse } from 'next/server';
import { exigirTaller } from '../../../../lib/servidor';
import { borrar, editar, enviar, resolver } from '../../../../lib/licencias';
import { crearAviso, ADMINS } from '../../../../lib/avisos';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * PATCH /api/licencias/:id
 *
 *   { accion: 'enviar' }                          el dueño manda su borrador
 *   { tipo, inicio, fin, motivo }                 el dueño edita, sin resolver aún
 *   { accion: 'aprobar' | 'rechazar', respuesta } el administrador decide
 */
export async function PATCH(peticion, { params }) {
  const { sesion, accesos, corte } = await exigirTaller();
  if (corte) return corte;

  const { id } = await params;
  const cuerpo = await peticion.json().catch(() => ({}));
  const { admin } = accesos;

  try {
    // --- Decisión del administrador ---
    if (cuerpo.accion === 'aprobar' || cuerpo.accion === 'rechazar') {
      if (!admin) return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });

      const estado = cuerpo.accion === 'aprobar' ? 'aprobada' : 'rechazada';
      const { error, solicitud } = await resolver(id, estado, cuerpo.respuesta, sesion.usuario);
      if (error) return NextResponse.json({ error }, { status: 400 });

      await crearAviso({
        para: solicitud.usuario,
        texto:
          `Tu ${solicitud.tipo} del ${solicitud.inicio} al ${solicitud.fin} fue ` +
          `${estado} por ${sesion.usuario}` +
          (solicitud.respuesta ? `: «${solicitud.respuesta}»` : '.'),
        enlace: '/licencias',
      });

      return NextResponse.json({ solicitud });
    }

    // --- El dueño manda su borrador ---
    if (cuerpo.accion === 'enviar') {
      const { error, solicitud } = await enviar(id, sesion.usuario);
      if (error) return NextResponse.json({ error }, { status: 400 });

      await crearAviso({
        para: ADMINS,
        texto: `${sesion.usuario} pidió ${solicitud.tipo} del ${solicitud.inicio} al ${solicitud.fin}.`,
        enlace: '/licencias',
      });

      return NextResponse.json({ solicitud });
    }

    // --- El dueño edita ---
    const { error, solicitud } = await editar(id, sesion.usuario, cuerpo);
    if (error) return NextResponse.json({ error }, { status: 400 });
    return NextResponse.json({ solicitud });
  } catch (e) {
    return NextResponse.json({ error: `No se pudo guardar: ${e.message}` }, { status: 500 });
  }
}

export async function DELETE(peticion, { params }) {
  const { sesion, accesos, corte } = await exigirTaller();
  if (corte) return corte;

  const { id } = await params;
  const { admin } = accesos;

  try {
    const { error, solicitud } = await borrar(id, sesion.usuario, admin);
    if (error) return NextResponse.json({ error }, { status: 400 });

    // Si el administrador borra la solicitud de otro, esa persona tiene que enterarse.
    if (admin && solicitud.usuario !== sesion.usuario) {
      await crearAviso({
        para: solicitud.usuario,
        texto: `${sesion.usuario} eliminó tu solicitud de ${solicitud.tipo} del ${solicitud.inicio}.`,
        enlace: '/licencias',
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: `No se pudo borrar: ${e.message}` }, { status: 500 });
  }
}
