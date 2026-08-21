import { NextResponse } from 'next/server';
import { exigirAdmin } from '../../../lib/servidor';
import { crearUsuario, listarUsuarios } from '../../../lib/usuarios';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Nunca devuelve sal ni hash: el panel no los necesita y no tienen por qué viajar. */
const publico = ({ usuario, admin, casino, taller, discord, suspendida }) => ({
  usuario,
  admin: Boolean(admin),
  casino: Boolean(casino),
  // Sin `casino` la bandera no significa nada: un mecánico normal siempre está en el taller.
  taller: !casino || Boolean(taller),
  discord: discord ?? null,
  suspendida: Boolean(suspendida),
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

/** POST body: { usuario, clave, admin, casino, taller } */
export async function POST(peticion) {
  const { corte } = await exigirAdmin();
  if (corte) return corte;

  const { usuario, clave, admin, casino, taller } = await peticion.json().catch(() => ({}));

  try {
    const { error, usuario: creado } = await crearUsuario(
      usuario,
      clave,
      admin,
      casino,
      taller
    );
    if (error) return NextResponse.json({ error }, { status: 400 });
    return NextResponse.json({ usuario: publico(creado) });
  } catch (e) {
    return NextResponse.json({ error: `No se pudo crear: ${e.message}` }, { status: 500 });
  }
}
