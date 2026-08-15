import { NextResponse } from 'next/server';
import { sesionActual } from '../../../../lib/servidor';
import { soloCasino } from '../../../../lib/usuarios';
import { corregirVarios, listar, partesNombre } from '../../../../lib/inventario';
import { hayLector, sugerirNombres } from '../../../../lib/gemini';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function exigirTaller() {
  const sesion = await sesionActual();
  if (!sesion) return { corte: NextResponse.json({ error: 'Sin sesión.' }, { status: 401 }) };
  if (await soloCasino(sesion.usuario)) {
    return { corte: NextResponse.json({ error: 'No autorizado.' }, { status: 403 }) };
  }
  return { sesion };
}

/**
 * POST — propone el nombre entero de los que están cortados. **No guarda nada.**
 *
 * Qué está cortado lo decide el servidor mirando el inventario, no el cliente: así no hay forma
 * de pedirle que «complete» un nombre que alguien escribió a mano.
 */
export async function POST() {
  const { corte } = await exigirTaller();
  if (corte) return corte;
  if (!hayLector()) {
    return NextResponse.json({ error: 'No hay lector configurado.' }, { status: 503 });
  }

  try {
    const articulos = await listar();
    const cortados = articulos.filter((a) => partesNombre(a.nombre).truncado);
    if (!cortados.length) return NextResponse.json({ sugerencias: [] });

    const { sugerencias, error } = await sugerirNombres(cortados.map((a) => a.nombre));
    if (error) return NextResponse.json({ error }, { status: 502 });

    // Se devuelve atado al artículo concreto: dos artículos pueden compartir el mismo texto
    // cortado —los dos «KIT DE REPARACI…»— y cada uno se renombra por su cuenta.
    const porCortado = new Map(sugerencias.map((s) => [s.cortado, s]));
    return NextResponse.json({
      sugerencias: cortados.map((a) => ({
        id: a.id,
        actual: a.nombre,
        peso: a.peso,
        cantidad: a.cantidad,
        completo: porCortado.get(a.nombre)?.completo ?? a.nombre,
        seguro: porCortado.get(a.nombre)?.seguro ?? false,
      })),
    });
  } catch (e) {
    return NextResponse.json({ error: `No se pudo sugerir: ${e.message}` }, { status: 500 });
  }
}

/** PUT — guarda los nombres que la persona aceptó. body: { cambios: [{ id, nombre }] } */
export async function PUT(peticion) {
  const { corte } = await exigirTaller();
  if (corte) return corte;

  const { cambios } = await peticion.json().catch(() => ({}));
  if (!Array.isArray(cambios) || !cambios.length) {
    return NextResponse.json({ error: 'No llegó ningún cambio.' }, { status: 400 });
  }

  try {
    const { tocados } = await corregirVarios(cambios);
    return NextResponse.json({ tocados, articulos: await listar() });
  } catch (e) {
    return NextResponse.json({ error: `No se pudo guardar: ${e.message}` }, { status: 500 });
  }
}
