// Dónde se guardan los datos. Dos backends tras la misma puerta:
//
//   Redis   si existen las variables de Vercel KV o Upstash. Es el modo de producción:
//           en Vercel el disco es efímero y se borra en cada despliegue.
//   Archivo si no hay variables. Guarda en .datos/*.json — sirve para desarrollo.
//
// Cada colección es un solo JSON que se lee y se reescribe entero. Con la cantidad de
// usuarios y turnos de un taller eso sobra. Si dos escrituras caen en el mismo instante
// exacto, una puede pisar a la otra; no vale la pena resolverlo a esta escala.
//
// OJO: usa node:fs, así que NO se puede importar desde el middleware, que corre en Edge.

export const USUARIOS = 'sunset:usuarios';
export const TURNOS = 'sunset:turnos';

function configRedis() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url, token } : null;
}

/** 'redis' o 'archivo'. Se muestra en el panel de admin para que no haya sorpresas. */
export function dondeGuarda() {
  return configRedis() ? 'redis' : 'archivo';
}

// Se usa el endpoint genérico de comandos de Upstash (POST con el comando en el cuerpo)
// en vez de /get/<clave>: así las claves con dos puntos no dependen de cómo se codifique
// la URL.
async function comando({ url, token }, ...partes) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(partes),
    cache: 'no-store',
  });
  if (!r.ok) throw new Error(`Redis respondió ${r.status} a ${partes[0]}`);
  const { result, error } = await r.json();
  if (error) throw new Error(`Redis: ${error}`);
  return result;
}

const archivoDe = (clave) => `.datos/${clave.replace('sunset:', '')}.json`;

async function leerArchivo(clave, porDefecto) {
  const { readFile } = await import('node:fs/promises');
  try {
    return JSON.parse(await readFile(archivoDe(clave), 'utf8'));
  } catch (e) {
    if (e.code === 'ENOENT') return porDefecto;
    throw e;
  }
}

async function escribirArchivo(clave, valor) {
  const { writeFile, mkdir } = await import('node:fs/promises');
  await mkdir('.datos', { recursive: true });
  await writeFile(archivoDe(clave), JSON.stringify(valor, null, 2), 'utf8');
}

export async function leer(clave, porDefecto = []) {
  const cfg = configRedis();
  if (!cfg) return leerArchivo(clave, porDefecto);
  const crudo = await comando(cfg, 'GET', clave);
  return crudo ? JSON.parse(crudo) : porDefecto;
}

export async function guardar(clave, valor) {
  const cfg = configRedis();
  if (!cfg) return escribirArchivo(clave, valor);
  await comando(cfg, 'SET', clave, JSON.stringify(valor));
}
