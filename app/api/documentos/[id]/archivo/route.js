import { NextResponse } from 'next/server';
import { sesionActual } from '../../../../../lib/servidor';
import { porId, puedeVerlo } from '../../../../../lib/documentos';
import { esAdmin } from '../../../../../lib/usuarios';
import { urlFirmada } from '../../../../../lib/imagenes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/documentos/:id/archivo → redirige al archivo firmado.
 *
 * Se comprueba **la asignación antes de firmar**: un documento asignado a alguien no se abre
 * con solo tener el enlace. Sin esto, filtrar la lista no serviría de nada — bastaría con
 * probar identificadores. El administrador abre cualquiera.
 *
 * Una hora de validez: un PDF se abre, se lee un rato y se vuelve a mirar.
 */
export async function GET(peticion, { params }) {
  const sesion = await sesionActual();
  if (!sesion) return NextResponse.json({ error: 'Sin sesión.' }, { status: 401 });

  const { id } = await params;
  const documento = await porId(id);
  if (!documento?.archivo) return NextResponse.json({ error: 'No existe.' }, { status: 404 });

  if (!puedeVerlo(documento, sesion.usuario) && !(await esAdmin(sesion.usuario))) {
    return NextResponse.json({ error: 'No es para ti.' }, { status: 403 });
  }

  const { url, error } = await urlFirmada(documento.archivo, 3600);
  if (error) return NextResponse.json({ error }, { status: 500 });

  return NextResponse.redirect(new URL(url, peticion.nextUrl.origin));
}
