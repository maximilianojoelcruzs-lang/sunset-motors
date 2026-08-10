import { NextResponse } from 'next/server';
import { sesionActual } from '../../../../lib/servidor';
import { esAdmin } from '../../../../lib/usuarios';
import { borrar, corregir } from '../../../../lib/turnos';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Corregir y borrar turnos es solo de administradores: si cada uno pudiera editar el
// suyo, el registro no serviría para controlar nada.
async function exigirAdmin() {
  const sesion = await sesionActual();
  if (!sesion) return { corte: NextResponse.json({ error: 'Sin sesión.' }, { status: 401 }) };
  if (!(await esAdmin(sesion.usuario))) {
    return { corte: NextResponse.json({ error: 'No autorizado.' }, { status: 403 }) };
  }
  return { sesion };
}

/** PATCH /api/turnos/:id  body: { entrada?, salida?, nota? } */
export async function PATCH(peticion, { params }) {
  const { sesion, corte } = await exigirAdmin();
  if (corte) return corte;

  const { id } = await params;
  const cambios = await peticion.json().catch(() => ({}));

  try {
    const { turno, error } = await corregir(id, cambios, sesion.usuario);
    if (error) return NextResponse.json({ error }, { status: 400 });
    return NextResponse.json({ turno });
  } catch (e) {
    return NextResponse.json({ error: `No se pudo guardar: ${e.message}` }, { status: 500 });
  }
}

/** DELETE /api/turnos/:id */
export async function DELETE(peticion, { params }) {
  const { corte } = await exigirAdmin();
  if (corte) return corte;

  const { id } = await params;

  try {
    const borrado = await borrar(id);
    if (!borrado) return NextResponse.json({ error: 'Ese turno no existe.' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: `No se pudo borrar: ${e.message}` }, { status: 500 });
  }
}
