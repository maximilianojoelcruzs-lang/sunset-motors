import { NextResponse } from 'next/server';
import { exigirTaller } from '../../../../lib/servidor';
import { borrar, editar, enviar, resolver } from '../../../../lib/devoluciones';
import { guardarImagen } from '../../../../lib/imagenes';
import { crearAviso, ADMINS } from '../../../../lib/avisos';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const pesos = new Intl.NumberFormat('es-CL');
const plata = (n) => `$${pesos.format(n)}`;

/**
 * PATCH /api/devoluciones/:id
 *
 * Con JSON:      { accion: 'enviar' | 'pagar' | 'rechazar', respuesta }
 * Con multipart: monto, descripcion y opcionalmente una captura nueva (editar).
 */
export async function PATCH(peticion, { params }) {
  const { sesion, accesos, corte } = await exigirTaller();
  if (corte) return corte;

  const { id } = await params;
  const { admin } = accesos;
  const tipo = peticion.headers.get('content-type') ?? '';

  try {
    // --- Acciones (JSON) ---
    if (tipo.includes('application/json')) {
      const cuerpo = await peticion.json().catch(() => ({}));

      if (cuerpo.accion === 'pagar' || cuerpo.accion === 'rechazar') {
        if (!admin) return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });

        const estado = cuerpo.accion === 'pagar' ? 'pagado' : 'rechazado';
        const { error, devolucion } = await resolver(id, estado, cuerpo.respuesta, sesion.usuario);
        if (error) return NextResponse.json({ error }, { status: 400 });

        await crearAviso({
          para: devolucion.usuario,
          texto:
            `Tu devolución de ${plata(devolucion.monto)} fue marcada como ${estado} ` +
            `por ${sesion.usuario}` +
            (devolucion.respuesta ? `: «${devolucion.respuesta}»` : '.'),
          enlace: '/devoluciones',
        });

        return NextResponse.json({ devolucion });
      }

      if (cuerpo.accion === 'enviar') {
        const { error, devolucion } = await enviar(id, sesion.usuario);
        if (error) return NextResponse.json({ error }, { status: 400 });

        await crearAviso({
          para: ADMINS,
          texto: `${sesion.usuario} pidió una devolución de ${plata(devolucion.monto)}.`,
          enlace: '/devoluciones',
        });
        await crearAviso({
          para: sesion.usuario,
          texto: `Enviaste una solicitud de devolución de ${plata(devolucion.monto)}. Queda pendiente de pagar.`,
          enlace: '/devoluciones',
        });

        return NextResponse.json({ devolucion });
      }

      return NextResponse.json({ error: 'Acción desconocida.' }, { status: 400 });
    }

    // --- Edición del dueño (multipart, puede traer captura nueva) ---
    const forma = await peticion.formData();
    const archivo = forma.get('captura');

    let imagen;
    if (archivo && typeof archivo === 'object' && archivo.size > 0) {
      const { ruta, error } = await guardarImagen(
        await archivo.arrayBuffer(),
        archivo.type,
        'devoluciones'
      );
      if (error) return NextResponse.json({ error }, { status: 400 });
      imagen = ruta;
    }

    const { error, devolucion } = await editar(id, sesion.usuario, {
      monto: forma.get('monto'),
      descripcion: forma.get('descripcion') ?? '',
      ...(imagen ? { imagen } : {}),
      // `null` cuando no viene: `editar()` distingue "no lo toques" de "quítalo".
      ...(forma.has('enlace') ? { enlace: forma.get('enlace') } : {}),
    });
    if (error) return NextResponse.json({ error }, { status: 400 });
    return NextResponse.json({ devolucion });
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
    const { error, devolucion } = await borrar(id, sesion.usuario, admin);
    if (error) return NextResponse.json({ error }, { status: 400 });

    if (admin && devolucion.usuario !== sesion.usuario) {
      await crearAviso({
        para: devolucion.usuario,
        texto: `${sesion.usuario} eliminó tu solicitud de devolución de ${plata(devolucion.monto)}.`,
        enlace: '/devoluciones',
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: `No se pudo borrar: ${e.message}` }, { status: 500 });
  }
}
