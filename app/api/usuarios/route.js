import { NextResponse } from 'next/server';
import { sesionActual } from '../../../lib/servidor';
import { crearUsuario, esAdmin, listarUsuarios } from '../../../lib/usuarios';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Administrar usuarios es solo de administradores. Se verifica en cada handler y no solo
// en el middleware, que además ya no puede: corre en Edge y no lee la base.
async function exigirAdmin() {
  const sesion = await sesionActual();
  if (!sesion) return { corte: NextResponse.json({ error: 'Sin sesión.' }, { status: 401 }) };
  if (!(await esAdmin(sesion.usuario))) {
    return { corte: NextResponse.json({ error: 'No autorizado.' }, { status: 403 }) };
  }
  return { sesion };
}

/** Nunca devuelve sal ni hash: el panel no los necesita y no tienen por qué viajar. */
const publico = ({ usuario, admin, discord }) => ({
  usuario,
  admin: Boolean(admin),
  discord: discord ?? null,
});

export async function GET() {
  const { corte } = await exigirAdmin();
  if (corte) return corte;

  try {
    return NextResponse.json({ usuarios: (await listarUsuarios()).map(publico) });
  } catch (e) {
    return NextResponse.json({ error: `No se pudo leer: ${e.message}` }, { status: 500 });
  }
}

/** POST body: { usuario, clave, admin } */
export async function POST(peticion) {
  const { corte } = await exigirAdmin();
  if (corte) return corte;

  const { usuario, clave, admin } = await peticion.json().catch(() => ({}));

  try {
    const { error, usuario: creado } = await crearUsuario(usuario, clave, admin);
    if (error) return NextResponse.json({ error }, { status: 400 });
    return NextResponse.json({ usuario: publico(creado) });
  } catch (e) {
    return NextResponse.json({ error: `No se pudo crear: ${e.message}` }, { status: 500 });
  }
}
