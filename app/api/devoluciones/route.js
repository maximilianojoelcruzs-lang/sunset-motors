import { NextResponse } from 'next/server';
import { sesionActual } from '../../../lib/servidor';
import { esAdmin } from '../../../lib/usuarios';
import { crear, listar, listarEnviadas } from '../../../lib/devoluciones';
import { guardarImagen } from '../../../lib/imagenes';
import { crearAviso, ADMINS } from '../../../lib/avisos';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const pesos = new Intl.NumberFormat('es-CL');

/**
 * GET /api/devoluciones         → las propias
 * GET /api/devoluciones?todas=1 → todas las enviadas, solo administradores
 */
export async function GET(peticion) {
  const sesion = await sesionActual();
  if (!sesion) return NextResponse.json({ error: 'Sin sesión.' }, { status: 401 });

  const quiereTodas = peticion.nextUrl.searchParams.get('todas') === '1';
  const admin = await esAdmin(sesion.usuario);

  if (quiereTodas && !admin) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });
  }

  try {
    return NextResponse.json({
      devoluciones: quiereTodas ? await listarEnviadas() : await listar(sesion.usuario),
      usuario: sesion.usuario,
      admin,
    });
  } catch (e) {
    return NextResponse.json({ error: `No se pudo leer: ${e.message}` }, { status: 500 });
  }
}

/**
 * POST /api/devoluciones — multipart: monto, descripcion, enviar, captura (archivo).
 *
 * Va como formulario y no como JSON porque trae la imagen. La imagen se sube primero: si
 * falla, no se crea una solicitud sin prueba.
 */
export async function POST(peticion) {
  const sesion = await sesionActual();
  if (!sesion) return NextResponse.json({ error: 'Sin sesión.' }, { status: 401 });

  try {
    const forma = await peticion.formData();
    const archivo = forma.get('captura');
    const enviar = forma.get('enviar') === '1';

    let imagen = null;
    if (archivo && typeof archivo === 'object' && archivo.size > 0) {
      const { ruta, error } = await guardarImagen(
        await archivo.arrayBuffer(),
        archivo.type,
        'devoluciones'
      );
      if (error) return NextResponse.json({ error }, { status: 400 });
      imagen = ruta;
    }

    const { error, devolucion } = await crear(sesion.usuario, {
      monto: forma.get('monto'),
      descripcion: forma.get('descripcion') ?? '',
      imagen,
      enlace: forma.get('enlace') ?? '',
      enviar,
    });
    if (error) return NextResponse.json({ error }, { status: 400 });

    if (devolucion.estado === 'pendiente') {
      const monto = `$${pesos.format(devolucion.monto)}`;
      await crearAviso({
        para: ADMINS,
        texto: `${sesion.usuario} pidió una devolución de ${monto}.`,
        enlace: '/devoluciones',
      });
      // La persona que la envía también recibe constancia de que salió.
      await crearAviso({
        para: sesion.usuario,
        texto: `Enviaste una solicitud de devolución de ${monto}. Queda pendiente de pagar.`,
        enlace: '/devoluciones',
      });
    }

    return NextResponse.json({ devolucion });
  } catch (e) {
    return NextResponse.json({ error: `No se pudo guardar: ${e.message}` }, { status: 500 });
  }
}
