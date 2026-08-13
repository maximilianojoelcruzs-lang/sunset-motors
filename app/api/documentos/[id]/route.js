import { NextResponse } from 'next/server';
import { sesionActual } from '../../../../lib/servidor';
import { esAdmin } from '../../../../lib/usuarios';
import { asignar, borrar, editar } from '../../../../lib/documentos';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function exigirAdmin() {
  const sesion = await sesionActual();
  if (!sesion) return { corte: NextResponse.json({ error: 'Sin sesión.' }, { status: 401 }) };
  if (!(await esAdmin(sesion.usuario))) {
    return { corte: NextResponse.json({ error: 'No autorizado.' }, { status: 403 }) };
  }
  return { sesion };
}

/** PATCH /api/documentos/:id  body: { titulo, descripcion, categoria } o { para } */
export async function PATCH(peticion, { params }) {
  const { corte } = await exigirAdmin();
  if (corte) return corte;

  const { id } = await params;
  const datos = await peticion.json().catch(() => ({}));

  try {
    // Asignar y desasignar son la misma llamada: manda la lista completa de destinatarios.
    if (Array.isArray(datos.para)) {
      const { error, documento } = await asignar(id, datos.para);
      if (error) return NextResponse.json({ error }, { status: 400 });
      return NextResponse.json({ documento });
    }

    const { error, documento } = await editar(id, datos);
    if (error) return NextResponse.json({ error }, { status: 400 });
    return NextResponse.json({ documento });
  } catch (e) {
    return NextResponse.json({ error: `No se pudo guardar: ${e.message}` }, { status: 500 });
  }
}

export async function DELETE(peticion, { params }) {
  const { corte } = await exigirAdmin();
  if (corte) return corte;

  const { id } = await params;

  try {
    const { error } = await borrar(id);
    if (error) return NextResponse.json({ error }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: `No se pudo borrar: ${e.message}` }, { status: 500 });
  }
}
