import { NextResponse } from 'next/server';
import { sesionActual } from '../../../../lib/servidor';
import { esAdmin, esCasino } from '../../../../lib/usuarios';
import { cerrarCiclo, ciclos, ranking, sembrarDesdeJugadas } from '../../../../lib/wager';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** El top lo ve cualquiera que pueda entrar al casino: es una tabla pública de la sala. */
async function exigirCasino() {
  const sesion = await sesionActual();
  if (!sesion) return { corte: NextResponse.json({ error: 'Sin sesión.' }, { status: 401 }) };
  if (!(await esCasino(sesion.usuario))) {
    return { corte: NextResponse.json({ error: 'No autorizado.' }, { status: 403 }) };
  }
  return { sesion };
}

export async function GET() {
  const { corte } = await exigirCasino();
  if (corte) return corte;

  try {
    const [actual, anteriores] = await Promise.all([ranking(), ciclos()]);
    return NextResponse.json({ ...actual, ciclos: anteriores });
  } catch (e) {
    return NextResponse.json({ error: `No se pudo leer: ${e.message}` }, { status: 500 });
  }
}

/**
 * POST — cerrar el ciclo y pagar el podio, o sembrar el contador. **Solo administrador.**
 *
 * Cerrar mueve fichas de verdad, así que no basta con esconder el botón: se comprueba acá.
 */
export async function POST(peticion) {
  const { sesion, corte } = await exigirCasino();
  if (corte) return corte;
  if (!(await esAdmin(sesion.usuario))) {
    return NextResponse.json({ error: 'Solo un administrador cierra el ciclo.' }, { status: 403 });
  }

  const { accion } = await peticion.json().catch(() => ({}));

  try {
    if (accion === 'sembrar') {
      const r = await sembrarDesdeJugadas();
      return NextResponse.json({ ...r, ...(await ranking()) });
    }

    if (accion === 'cerrar') {
      const r = await cerrarCiclo(sesion.usuario);
      if (r.error) return NextResponse.json({ error: r.error }, { status: 400 });
      return NextResponse.json({ ...r, ...(await ranking()), ciclos: await ciclos() });
    }

    return NextResponse.json({ error: 'Acción desconocida.' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: `No se pudo completar: ${e.message}` }, { status: 500 });
  }
}
