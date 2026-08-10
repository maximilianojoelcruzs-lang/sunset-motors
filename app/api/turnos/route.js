import { NextResponse } from 'next/server';
import { sesionActual } from '../../../lib/servidor';
import { esAdmin, nombres } from '../../../lib/usuarios';
import { dondeGuarda } from '../../../lib/almacen';
import { listar, marcarEntrada, marcarSalida } from '../../../lib/turnos';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// El middleware ya exige sesión; igual se revisa acá porque un route handler no debe
// depender de que alguien más lo haya protegido.
async function exigirSesion() {
  const sesion = await sesionActual();
  if (!sesion) return { corte: NextResponse.json({ error: 'Sin sesión.' }, { status: 401 }) };
  return { sesion };
}

/**
 * GET /api/turnos → el registro completo. Solo administradores.
 *
 * No hay variante para consultar el historial propio: un mecánico no tiene por qué leer
 * el registro, ni el suyo. Lo único que ve de sus turnos es si tiene uno abierto ahora,
 * y eso se lo entrega la página en app/page.js para dibujar el botón de marcaje.
 */
export async function GET() {
  const { sesion, corte } = await exigirSesion();
  if (corte) return corte;

  if (!(await esAdmin(sesion.usuario))) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });
  }

  try {
    return NextResponse.json({
      turnos: await listar(),
      usuario: sesion.usuario,
      usuarios: await nombres(),
      almacen: dondeGuarda(),
    });
  } catch (e) {
    return NextResponse.json({ error: `No se pudo leer el registro: ${e.message}` }, { status: 500 });
  }
}

/** POST /api/turnos  body: { accion: 'entrada' | 'salida' } */
export async function POST(peticion) {
  const { sesion, corte } = await exigirSesion();
  if (corte) return corte;

  const { accion } = await peticion.json().catch(() => ({}));

  try {
    if (accion === 'entrada') {
      const { turno, yaEstaba } = await marcarEntrada(sesion.usuario);
      return NextResponse.json({ turno, yaEstaba });
    }

    if (accion === 'salida') {
      const turno = await marcarSalida(sesion.usuario);
      if (!turno) {
        return NextResponse.json({ error: 'No tienes un turno abierto.' }, { status: 409 });
      }
      return NextResponse.json({ turno });
    }

    return NextResponse.json({ error: 'Acción desconocida.' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: `No se pudo guardar: ${e.message}` }, { status: 500 });
  }
}
