// Guardado de imágenes: capturas de devoluciones y flyers.
//
// Las imágenes no caben en el almacén de documentos JSON, así que van aparte:
//
//   Supabase Storage  si hay credenciales. Bucket PRIVADO: nada se sirve por URL pública,
//                     cada vista genera una URL firmada de corta duración.
//   Archivo local     si no las hay. Guarda en .datos/imagenes/ — solo para desarrollo.
//
// El bucket privado es la razón de que exista `urlFirmada`: no basta con conocer la ruta de
// una imagen para verla, hay que pedirle al servidor que la firme, y el servidor solo firma
// después de comprobar quién pregunta.

export const BUCKET = 'sunset';

/** Lo que aceptamos subir, con su extensión. Nada de SVG: puede traer scripts dentro. */
const TIPOS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

export const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

/** Capturas y flyers son solo imágenes; los documentos aceptan además PDF. */
export const IMAGENES = ['image/jpeg', 'image/png', 'image/webp'];
export const DOCUMENTOS = [...IMAGENES, 'application/pdf'];

function configSupabase() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const llave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !llave) return null;
  return { url: url.trim().replace(/\/+$/, '').replace(/\/rest\/v1$/, ''), llave };
}

export const hayStorage = () => Boolean(configSupabase());

const cabeceras = ({ llave }) => ({ apikey: llave, Authorization: `Bearer ${llave}` });

/**
 * Reconoce el formato por los primeros bytes del archivo, no por lo que diga el navegador:
 * el tipo declarado lo controla quien sube, así que renombrar un .txt a .png lo colaría.
 * Devuelve el tipo real o null.
 */
function tipoReal(bytes) {
  const b = new Uint8Array(bytes);
  if (b.length < 12) return null;

  const empieza = (...bs) => bs.every((v, i) => b[i] === v);

  if (empieza(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'image/png';
  if (empieza(0xff, 0xd8, 0xff)) return 'image/jpeg';

  const texto = (i, n) => String.fromCharCode(...b.slice(i, i + n));

  // WEBP: "RIFF" .... "WEBP"
  if (texto(0, 4) === 'RIFF' && texto(8, 4) === 'WEBP') return 'image/webp';
  // PDF: "%PDF-"
  if (texto(0, 5) === '%PDF-') return 'application/pdf';

  return null;
}

/**
 * Guarda un archivo y devuelve su ruta interna (no una URL: la ruta sola no sirve para
 * verlo). `carpeta` separa los usos: 'devoluciones', 'flyers', 'documentos'.
 * `permitidos` acota qué formatos acepta cada uso.
 */
export async function guardarImagen(bytes, tipoDeclarado, carpeta, permitidos = IMAGENES) {
  if (bytes.byteLength > MAX_BYTES) {
    return { error: `El archivo pesa más de ${Math.round(MAX_BYTES / 1024 / 1024)} MB.` };
  }

  // Manda el contenido, no la etiqueta. Si no calzan, el archivo no es lo que dice ser.
  const tipo = tipoReal(bytes);
  if (!tipo || !permitidos.includes(tipo)) {
    const nombres = permitidos.map((t) => TIPOS[t].toUpperCase()).join(', ');
    return { error: `Ese archivo no es de un tipo aceptado (${nombres}).` };
  }
  if (tipoDeclarado && TIPOS[tipoDeclarado] && tipoDeclarado !== tipo) {
    return { error: `El archivo dice ser ${tipoDeclarado} pero es ${tipo}.` };
  }

  const extension = TIPOS[tipo];

  const ruta = `${carpeta}/${crypto.randomUUID()}.${extension}`;
  const cfg = configSupabase();
  const devolver = { ruta, tipo, tamano: bytes.byteLength };

  if (!cfg) {
    const { writeFile, mkdir } = await import('node:fs/promises');
    const { dirname } = await import('node:path');
    const destino = `.datos/imagenes/${ruta}`;
    await mkdir(dirname(destino), { recursive: true });
    await writeFile(destino, Buffer.from(bytes));
    return devolver;
  }

  const r = await fetch(`${cfg.url}/storage/v1/object/${BUCKET}/${ruta}`, {
    method: 'POST',
    headers: { ...cabeceras(cfg), 'Content-Type': tipo, 'x-upsert': 'false' },
    body: bytes,
  });

  if (!r.ok) {
    const detalle = (await r.text()).slice(0, 200);
    if (r.status === 404) {
      return { error: `Falta crear el bucket «${BUCKET}» en Supabase Storage.` };
    }
    return { error: `Supabase Storage respondió ${r.status}: ${detalle}` };
  }

  return devolver;
}

/**
 * URL para mostrar la imagen. En Supabase es firmada y caduca; en local es la ruta que
 * sirve nuestro propio endpoint. Quien llame a esto ya debe haber comprobado permisos.
 */
export async function urlFirmada(ruta, segundos = 300) {
  const cfg = configSupabase();
  if (!cfg) return { url: `/api/imagen-local/${ruta}` };

  const r = await fetch(`${cfg.url}/storage/v1/object/sign/${BUCKET}/${ruta}`, {
    method: 'POST',
    headers: { ...cabeceras(cfg), 'Content-Type': 'application/json' },
    body: JSON.stringify({ expiresIn: segundos }),
  });

  if (!r.ok) return { error: `No se pudo firmar la imagen (${r.status}).` };

  const { signedURL, signedUrl } = await r.json();
  const relativa = signedURL ?? signedUrl;
  return { url: `${cfg.url}/storage/v1${relativa}` };
}

export async function borrarImagen(ruta) {
  if (!ruta) return;
  const cfg = configSupabase();

  if (!cfg) {
    const { unlink } = await import('node:fs/promises');
    await unlink(`.datos/imagenes/${ruta}`).catch(() => {});
    return;
  }

  await fetch(`${cfg.url}/storage/v1/object/${BUCKET}/${ruta}`, {
    method: 'DELETE',
    headers: cabeceras(cfg),
  }).catch(() => {});
}
