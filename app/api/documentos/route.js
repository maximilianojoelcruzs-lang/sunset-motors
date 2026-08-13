import { NextResponse } from 'next/server';
import { sesionActual } from '../../../lib/servidor';
import { esAdmin, nombres } from '../../../lib/usuarios';
import { crear, listar, listarPara } from '../../../lib/documentos';
import { guardarImagen, DOCUMENTOS } from '../../../lib/imagenes';
import { crearAvisos } from '../../../lib/avisos';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/documentos → los que le tocan a quien pregunta. El administrador ve todos.
 *
 * El filtro es de acá. Mandar la lista entera y esconder filas en la pantalla dejaría los
 * documentos asignados a un `fetch` de distancia de cualquiera con sesión.
 */
export async function GET() {
  const sesion = await sesionActual();
  if (!sesion) return NextResponse.json({ error: 'Sin sesión.' }, { status: 401 });

  try {
    const admin = await esAdmin(sesion.usuario);
    const documentos = admin ? await listar() : await listarPara(sesion.usuario);
    return NextResponse.json({ documentos });
  } catch (e) {
    return NextResponse.json({ error: `No se pudo leer: ${e.message}` }, { status: 500 });
  }
}

/** POST /api/documentos — multipart: titulo, descripcion, categoria, archivo. Solo admin. */
export async function POST(peticion) {
  const sesion = await sesionActual();
  if (!sesion) return NextResponse.json({ error: 'Sin sesión.' }, { status: 401 });
  if (!(await esAdmin(sesion.usuario))) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });
  }

  try {
    const forma = await peticion.formData();
    const archivo = forma.get('archivo');

    if (!archivo || typeof archivo !== 'object' || archivo.size === 0) {
      return NextResponse.json({ error: 'Falta el archivo.' }, { status: 400 });
    }

    const subido = await guardarImagen(
      await archivo.arrayBuffer(),
      archivo.type,
      'documentos',
      DOCUMENTOS
    );
    if (subido.error) return NextResponse.json({ error: subido.error }, { status: 400 });

    const { error, documento } = await crear(sesion.usuario, {
      titulo: forma.get('titulo') ?? '',
      descripcion: forma.get('descripcion') ?? '',
      categoria: forma.get('categoria') ?? '',
      para: JSON.parse(forma.get('para') || '[]'),
      archivo: subido.ruta,
      tipo: subido.tipo,
      tamano: subido.tamano,
    });
    if (error) return NextResponse.json({ error }, { status: 400 });

    // El aviso va solo a quien puede verlo: avisar de un documento que no se puede abrir
    // es peor que no avisar. De una sola escritura.
    const asignado = documento.para?.length ? documento.para : null;
    const gente = (asignado ?? (await nombres())).filter((u) => u !== sesion.usuario);
    await crearAvisos(
      gente.map((quien) => ({
        para: quien,
        texto: `Documento nuevo: «${documento.titulo}».`,
        enlace: '/documentos',
      }))
    );

    return NextResponse.json({ documento });
  } catch (e) {
    return NextResponse.json({ error: `No se pudo guardar: ${e.message}` }, { status: 500 });
  }
}
