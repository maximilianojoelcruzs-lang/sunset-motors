import { NextResponse } from 'next/server';
import { sesionActual } from '../../../../lib/servidor';
import { soloCasino } from '../../../../lib/usuarios';
import { hayLector, leerCaptura } from '../../../../lib/gemini';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Una captura de pantalla comprimida no llega a esto ni de lejos; el tope está para que nadie
// mande un vídeo de 40 MB y quede el servidor esperando.
const MAX_BYTES = 8 * 1024 * 1024;
const TIPOS = ['image/png', 'image/jpeg', 'image/webp'];

/** Los primeros bytes mandan, no la etiqueta que ponga el navegador. */
function tipoReal(bytes) {
  const b = new Uint8Array(bytes);
  if (b[0] === 0x89 && b[1] === 0x50) return 'image/png';
  if (b[0] === 0xff && b[1] === 0xd8) return 'image/jpeg';
  if (b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp';
  return null;
}

/**
 * POST /api/inventario/leer — sube una captura y devuelve lo que se lee en ella.
 *
 * **No guarda nada.** Devuelve las filas para que la pantalla las enseñe en la tabla de
 * confirmación; guardarlas es otra llamada, después de que una persona las mire.
 *
 * La llamada a Gemini se hace acá y no en el navegador: si la hiciera el cliente, la llave
 * viajaría con él y quedaría a la vista de cualquiera.
 */
export async function POST(peticion) {
  const sesion = await sesionActual();
  if (!sesion) return NextResponse.json({ error: 'Sin sesión.' }, { status: 401 });
  if (await soloCasino(sesion.usuario)) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });
  }
  if (!hayLector()) {
    return NextResponse.json(
      { error: 'No hay lector de capturas configurado. Anota el conteo a mano.' },
      { status: 503 }
    );
  }

  let archivo;
  try {
    archivo = (await peticion.formData()).get('imagen');
  } catch {
    return NextResponse.json({ error: 'No llegó la imagen.' }, { status: 400 });
  }
  if (!archivo || typeof archivo === 'string') {
    return NextResponse.json({ error: 'No llegó la imagen.' }, { status: 400 });
  }
  if (archivo.size > MAX_BYTES) {
    return NextResponse.json({ error: 'La imagen pesa más de 8 MB.' }, { status: 400 });
  }

  const bytes = await archivo.arrayBuffer();
  const tipo = tipoReal(bytes);
  if (!tipo || !TIPOS.includes(tipo)) {
    return NextResponse.json({ error: 'Eso no es una imagen PNG, JPG o WEBP.' }, { status: 400 });
  }

  const { filas, error } = await leerCaptura(bytes, tipo);
  if (error) return NextResponse.json({ error }, { status: 502 });
  return NextResponse.json({ filas });
}
