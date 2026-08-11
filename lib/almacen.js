// Dónde se guardan los datos. Tres backends tras la misma puerta, elegidos por las
// variables de entorno que existan:
//
//   supabase  SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY. Es el modo recomendado.
//   redis     KV_REST_API_* o UPSTASH_REDIS_REST_*. Sirve igual si ya tienes una.
//   archivo   ninguna de las anteriores. Guarda en .datos/*.json — solo para desarrollo:
//             en Vercel el disco es efímero y se borra en cada despliegue.
//
// Cada colección es un solo JSON que se lee y se reescribe entero. Con la cantidad de
// usuarios y turnos de un taller eso sobra. Si dos escrituras caen en el mismo instante
// exacto, una puede pisar a la otra; no vale la pena resolverlo a esta escala.
//
// OJO: usa node:fs, así que NO se puede importar desde el middleware, que corre en Edge.

export const USUARIOS = 'sunset:usuarios';
export const TURNOS = 'sunset:turnos';

/** Tabla de Supabase. Su SQL de creación está en PUBLICAR.md. */
const TABLA = 'datos';

/**
 * Supabase muestra en la misma pantalla el "Project URL" y la URL del API REST, que es la
 * misma más /rest/v1. Pegar la segunda es un error fácil y el síntoma es un 404 PGRST125
 * bastante opaco, porque la ruta queda duplicada. Se normaliza acá en vez de exigir acierto.
 */
const raizSupabase = (url) => url.trim().replace(/\/+$/, '').replace(/\/rest\/v1$/, '');

function configSupabase() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  // La service_role, no la anon: esto corre solo en el servidor y necesita saltarse RLS.
  // Nunca debe llevar prefijo NEXT_PUBLIC_, o Next la enviaría al navegador.
  const llave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && llave ? { url: raizSupabase(url), llave } : null;
}

function configRedis() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url, token } : null;
}

/** 'supabase', 'redis' o 'archivo'. Se muestra en el panel para que no haya sorpresas. */
export function dondeGuarda() {
  if (configSupabase()) return 'supabase';
  if (configRedis()) return 'redis';
  return 'archivo';
}

// ---------- Supabase (PostgREST) ----------

const cabecerasSupabase = ({ llave }) => ({
  apikey: llave,
  Authorization: `Bearer ${llave}`,
  'Content-Type': 'application/json',
});

async function leerSupabase(cfg, clave, porDefecto) {
  const url = `${cfg.url}/rest/v1/${TABLA}?clave=eq.${encodeURIComponent(clave)}&select=valor`;
  const r = await fetch(url, { headers: cabecerasSupabase(cfg), cache: 'no-store' });

  if (!r.ok) {
    throw new Error(`Supabase respondió ${r.status} al leer: ${(await r.text()).slice(0, 200)}`);
  }

  const filas = await r.json();
  return filas.length ? filas[0].valor : porDefecto;
}

async function escribirSupabase(cfg, clave, valor) {
  // Upsert: si la fila ya existe se reemplaza en vez de fallar por clave duplicada.
  const url = `${cfg.url}/rest/v1/${TABLA}?on_conflict=clave`;
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      ...cabecerasSupabase(cfg),
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify({ clave, valor }),
  });

  if (!r.ok) {
    throw new Error(`Supabase respondió ${r.status} al guardar: ${(await r.text()).slice(0, 200)}`);
  }
}

// ---------- Redis (Upstash / Vercel KV) ----------

// Se usa el endpoint genérico de comandos (POST con el comando en el cuerpo) en vez de
// /get/<clave>: así las claves con dos puntos no dependen de cómo se codifique la URL.
async function comandoRedis({ url, token }, ...partes) {
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

// ---------- Archivo local ----------

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

// ---------- La puerta ----------

export async function leer(clave, porDefecto = []) {
  const supabase = configSupabase();
  if (supabase) return leerSupabase(supabase, clave, porDefecto);

  const redis = configRedis();
  if (redis) {
    const crudo = await comandoRedis(redis, 'GET', clave);
    return crudo ? JSON.parse(crudo) : porDefecto;
  }

  return leerArchivo(clave, porDefecto);
}

export async function guardar(clave, valor) {
  const supabase = configSupabase();
  if (supabase) return escribirSupabase(supabase, clave, valor);

  const redis = configRedis();
  if (redis) return void (await comandoRedis(redis, 'SET', clave, JSON.stringify(valor)));

  return escribirArchivo(clave, valor);
}
