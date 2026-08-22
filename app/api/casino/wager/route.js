import { NextResponse } from 'next/server';
import { exigirCasino } from '../../../../lib/servidor';
import { cerrarCiclo, ciclos, iniciarCiclo, ranking } from '../../../../lib/wager';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
 * POST — abrir un ciclo nuevo, o cerrar el actual y pagar el podio. **Solo administrador.**
 *
 * Cerrar mueve fichas de verdad, así que no basta con esconder el botón: se comprueba acá.
 */
export async function POST(peticion) {
  const { sesion, accesos, corte } = await exigirCasino();
  if (corte) return corte;
  if (!accesos.admin) {
    return NextResponse.json({ error: 'Solo un administrador cierra el ciclo.' }, { status: 403 });
  }

  const { accion } = await peticion.json().catch(() => ({}));

  try {
    if (accion === 'iniciar') {
      const r = await iniciarCiclo();
      if (r.error) return NextResponse.json({ error: r.error }, { status: 400 });
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
