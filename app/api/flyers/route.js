import { NextResponse } from 'next/server';
import { exigirAdmin, exigirTaller } from '../../../lib/servidor';
import { nombres } from '../../../lib/usuarios';
import { crearFlyer, listarFlyers } from '../../../lib/anuncios';
import { guardarImagen } from '../../../lib/imagenes';
import { crearAvisos } from '../../../lib/avisos';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/flyers → todos los flyers. Cualquiera con sesión: son para todo el taller. */
export async function GET() {
  const { sesion, corte } = await exigirTaller();
  if (corte) return corte;

  try {
    return NextResponse.json({ flyers: await listarFlyers() });
  } catch (e) {
    return NextResponse.json({ error: `No se pudo leer: ${e.message}` }, { status: 500 });
  }
}

/** POST /api/flyers — multipart: titulo, imagen. Solo administradores publican. */
export async function POST(peticion) {
  const { sesion, corte } = await exigirAdmin();
  if (corte) return corte;

  try {
    const forma = await peticion.formData();
    const archivo = forma.get('imagen');

    if (!archivo || typeof archivo !== 'object' || archivo.size === 0) {
      return NextResponse.json({ error: 'Falta la imagen del flyer.' }, { status: 400 });
    }

    const { ruta, error: fallo } = await guardarImagen(
      await archivo.arrayBuffer(),
      archivo.type,
      'flyers'
    );
    if (fallo) return NextResponse.json({ error: fallo }, { status: 400 });

    const { error, flyer } = await crearFlyer(sesion.usuario, {
      titulo: forma.get('titulo') ?? '',
      imagen: ruta,
    });
    if (error) return NextResponse.json({ error }, { status: 400 });

    // Un flyer nuevo es justamente lo que el taller tiene que ver, así que se avisa a todos.
    // De una sola escritura: uno por uno reescribiría la colección entera por cada persona.
    const gente = (await nombres()).filter((u) => u !== sesion.usuario);
    await crearAvisos(
      gente.map((quien) => ({
        para: quien,
        texto: `Nuevo flyer: «${flyer.titulo}».`,
        enlace: '/anuncios',
      }))
    );

    return NextResponse.json({ flyer });
  } catch (e) {
    return NextResponse.json({ error: `No se pudo guardar: ${e.message}` }, { status: 500 });
  }
}
