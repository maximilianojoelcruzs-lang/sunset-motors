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

/**
 * Actualiza la fila **solo si su `rev` sigue siendo el que se leyó**.
 *
 * PostgREST deja filtrar por un campo del jsonb, así que la comparación y la escritura son una
 * sola sentencia: no hay hueco entre mirar y escribir. Con `return=representation` la respuesta
 * trae las filas tocadas, y cero filas significa que otro se adelantó.
 */
async function actualizarSiSupabase(cfg, clave, filtroRev, sobre) {
  const url =
    `${cfg.url}/rest/v1/${TABLA}` +
    `?clave=eq.${encodeURIComponent(clave)}&valor->>rev=${filtroRev}`;

  const r = await fetch(url, {
    method: 'PATCH',
    headers: { ...cabecerasSupabase(cfg), Prefer: 'return=representation' },
    body: JSON.stringify({ valor: sobre }),
  });

  if (!r.ok) {
    throw new Error(`Supabase respondió ${r.status} al guardar: ${(await r.text()).slice(0, 200)}`);
  }

  const filas = await r.json().catch(() => []);
  return Array.isArray(filas) && filas.length > 0;
}

/**
 * Crea la fila, y **falla si otro la creó primero**.
 *
 * Sin `on_conflict`, Postgres rechaza el duplicado por clave primaria y PostgREST devuelve 409.
 * Ese rechazo es justo lo que hace falta: quien pierde la carrera se entera y reintenta sobre la
 * fila que ya existe, en vez de escribir encima.
 */
async function crearSiFaltaSupabase(cfg, clave, sobre) {
  const r = await fetch(`${cfg.url}/rest/v1/${TABLA}`, {
    method: 'POST',
    headers: { ...cabecerasSupabase(cfg), Prefer: 'return=minimal' },
    body: JSON.stringify({ clave, valor: sobre }),
  });

  if (r.ok) return true;
  if (r.status === 409) return false;
  throw new Error(`Supabase respondió ${r.status} al crear: ${(await r.text()).slice(0, 200)}`);
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

// Una cola por archivo. `writeFile` no es atómico: dos escrituras a la vez se entrelazan y
// dejan el JSON roto — medido, con seis marcajes simultáneos el archivo quedó ilegible. Escribir
// de a una lo evita, y en modo archivo siempre es un solo proceso, así que basta.
//
// (Se probó con archivo temporal + renombrado, que sería atómico de verdad, pero en Windows con
// OneDrive vigilando la carpeta el renombrado falla con EPERM.)
const colaArchivo = new Map();

async function escribirArchivo(clave, valor) {
  const anterior = colaArchivo.get(clave) ?? Promise.resolve();

  const tarea = anterior.then(async () => {
    const { writeFile, mkdir } = await import('node:fs/promises');
    await mkdir('.datos', { recursive: true });
    await writeFile(archivoDe(clave), JSON.stringify(valor, null, 2), 'utf8');
  });

  // `then(x, x)` para que un fallo no deje la cola rota para siempre.
  colaArchivo.set(clave, tarea.then(() => {}, () => {}));
  return tarea;
}

/** Igual que la anterior, pero solo si el testigo coincide. Va por la misma cola. */
async function escribirArchivoSi(clave, rev, sobre) {
  const anterior = colaArchivo.get(clave) ?? Promise.resolve();

  const tarea = anterior.then(async () => {
    const { writeFile, mkdir } = await import('node:fs/promises');
    const actual = await leerArchivo(clave, null);
    const ahora = actual && !Array.isArray(actual) ? (actual.rev ?? null) : null;
    // `null` es una condición como cualquier otra: significa «esto tiene que seguir sin
    // testigo». Sin comparar ese caso, con la colección vacía escribían todos y ganaba el
    // último — que es justo lo que pasaba al empezar el turno.
    if (ahora !== rev) return false;

    await mkdir('.datos', { recursive: true });
    await writeFile(archivoDe(clave), JSON.stringify(sobre, null, 2), 'utf8');
    return true;
  });

  colaArchivo.set(clave, tarea.then(() => {}, () => {}));
  return tarea;
}

// ---------- La puerta ----------
//
// Lo guardado va envuelto: `{ rev, datos }`. `rev` es un testigo que cambia en cada escritura y
// es lo que permite escribir **solo si nadie tocó la colección desde que la leí** — sin eso, dos
// personas marcando a la vez leen lo mismo y la segunda borra a la primera.
//
// Lo viejo se sigue leyendo: una colección guardada como arreglo pelado se entiende igual, y a
// la primera escritura queda envuelta. No hay que migrar nada a mano.

const nuevaRev = () => crypto.randomUUID();

const desenvolver = (crudo, porDefecto) => {
  if (crudo == null) return { datos: porDefecto, rev: null };
  if (Array.isArray(crudo)) return { datos: crudo, rev: null };
  if (typeof crudo === 'object' && 'datos' in crudo) {
    return { datos: crudo.datos ?? porDefecto, rev: crudo.rev ?? null };
  }
  return { datos: crudo, rev: null };
};

/**
 * Contar lecturas y escrituras por petición es la primera medida cuando algo se siente lento:
 * contra Supabase cada una es una ida y vuelta por la red, y las que sobran casi nunca se ven
 * leyendo el código. Con `SUNSET_TRAZA=1` se imprimen.
 */
const traza = (que, clave) => {
  if (process.env.SUNSET_TRAZA) console.log(`[almacen] ${que} ${clave}`);
};

async function crudoDe(clave) {
  traza('leer', clave);
  const supabase = configSupabase();
  if (supabase) return leerSupabase(supabase, clave, null);

  const redis = configRedis();
  if (redis) {
    const texto = await comandoRedis(redis, 'GET', clave);
    return texto ? JSON.parse(texto) : null;
  }

  return leerArchivo(clave, null);
}

export async function leer(clave, porDefecto = []) {
  return desenvolver(await crudoDe(clave), porDefecto).datos;
}

/** Lo mismo, pero con el testigo, para poder escribir de forma condicional. */
export async function leerConRev(clave, porDefecto = []) {
  return desenvolver(await crudoDe(clave), porDefecto);
}

async function escribir(clave, sobre) {
  traza('guardar', clave);
  const supabase = configSupabase();
  if (supabase) return escribirSupabase(supabase, clave, sobre);

  const redis = configRedis();
  if (redis) return void (await comandoRedis(redis, 'SET', clave, JSON.stringify(sobre)));

  return escribirArchivo(clave, sobre);
}

export async function guardar(clave, valor) {
  return escribir(clave, { rev: nuevaRev(), datos: valor });
}

/**
 * Escribe **solo si la colección sigue teniendo el testigo `rev`**. Devuelve si se aplicó.
 *
 * Es lo que convierte «leer, cambiar, guardar» en una operación segura: quien perdió la carrera
 * se entera y rehace su cambio sobre lo que hay ahora, en vez de borrar el trabajo del otro.
 */
export async function guardarSi(clave, rev, valor) {
  const sobre = { rev: nuevaRev(), datos: valor };
  traza('guardarSi', clave);

  const supabase = configSupabase();
  if (supabase) {
    // Sin testigo hay dos casos, y los dos tienen que ser condicionales:
    //   · la fila existe con el formato viejo → actualizar solo si sigue sin testigo
    //   · la fila no existe                   → crearla, y perder si otro se adelantó
    if (!rev) {
      if (await actualizarSiSupabase(supabase, clave, 'is.null', sobre)) return true;
      return crearSiFaltaSupabase(supabase, clave, sobre);
    }
    return actualizarSiSupabase(supabase, clave, `eq.${encodeURIComponent(rev)}`, sobre);
  }

  const redis = configRedis();
  if (redis) {
    // Upstash no compara valores; se mira el testigo justo antes. La ventana es mínima y este
    // backend es el secundario — el recomendado es Supabase.
    const ahora = desenvolver(await crudoDe(clave), null).rev;
    if (ahora !== rev) return false;
    await escribir(clave, sobre);
    return true;
  }

  // En modo archivo las escrituras van en cola dentro del mismo proceso, así que comprobar el
  // testigo ahí dentro sí es atómico.
  return escribirArchivoSi(clave, rev, sobre);
}

/**
 * Cambia una colección **sin que otro que escriba a la vez se lleve el cambio por delante**.
 *
 * Cada colección es un solo JSON que se lee y se reescribe entero, así que dos operaciones
 * simultáneas leen lo mismo y la segunda en guardar borra a la primera. Medido: seis personas
 * marcando entrada a la vez dejaban **un** turno guardado, y a las seis se les decía que sí.
 *
 * Acá se escribe y **se vuelve a leer para comprobar que el cambio sobrevivió**. Si no, se
 * rehace sobre lo que hay ahora — no sobre lo que había antes, que es lo que lo hace correcto.
 * Tras varios intentos se responde que no se pudo, y eso es mucho mejor que decir que sí.
 *
 * `aplicar(lista)` devuelve `{ lista, hecho }`, o `null` si no había nada que cambiar.
 * `confirmar(listaLeida, hecho)` dice si el cambio está en lo que quedó guardado.
 */
// Diez intentos y no cinco: contra Supabase cada vuelta son dos idas por la red, y midiendo con
// diez escrituras a la vez uno se quedaba sin turnos. Marcar entrada pasa una vez por turno; que
// tarde medio segundo más no lo nota nadie, que no quede sí.
/**
 * `modificar` con la forma que tiene casi todo en `lib/`: devolver lo guardado o un error.
 *
 * `aplicar(lista)` recibe la lista **recién leída** y devuelve `{ lista, valor }` para guardar,
 * o `{ error }` para no tocar nada. Si otro escribió entremedio se vuelve a llamar con lo que
 * hay ahora, así que las comprobaciones de dentro se rehacen contra la lista de verdad.
 *
 * Existe porque el patrón «leer, cambiar, guardar» estaba escrito a mano en cuarenta sitios, y
 * en todos perdía escrituras simultáneas: medido, **de seis solicitudes creadas en el mismo
 * instante quedaba una**. Es el mismo fallo que se arregló en los turnos, que estaba en todo
 * lo demás.
 *
 * Lo que se calcule fuera del callback (un `randomUUID`, una fecha) se mantiene igual entre
 * intentos, que es justo lo que se quiere: reintentar no debe crear dos identificadores.
 */
export async function cambiar(clave, aplicar, { porDefecto = [] } = {}) {
  let salida = null;

  const { ok } = await modificar(
    clave,
    (lista) => {
      salida = aplicar(lista);
      if (!salida || salida.error || !salida.lista) return null;
      return { lista: salida.lista, hecho: true };
    },
    undefined,
    { porDefecto }
  );

  if (salida?.error) return { error: salida.error };
  if (!ok) {
    return {
      error: 'Varias personas guardaron a la vez y no se pudo aplicar. Vuelve a intentarlo.',
    };
  }
  return salida?.valor ?? { ok: true };
}

export async function modificar(clave, aplicar, _confirmar, { intentos = 10, porDefecto = [] } = {}) {
  for (let intento = 0; intento < intentos; intento++) {
    const { datos, rev } = await leerConRev(clave, porDefecto);
    const paso = aplicar(datos);
    if (!paso) return { ok: true, hecho: null };

    if (await guardarSi(clave, rev, paso.lista)) return { ok: true, hecho: paso.hecho };

    // Otro escribió entremedio. Se espera un poco —y distinto cada vez, para que dos que
    // chocan no vuelvan a chocar en el mismo instante— y se rehace sobre lo que hay ahora.
    // La espera crece con los intentos: si diez chocan a la vez, separarlos poco a poco los
    // deja pasar en fila en vez de volver a chocar todos otra vez.
    await new Promise((listo) => setTimeout(listo, 40 * (intento + 1) + Math.random() * 150));
  }

  return { ok: false, hecho: null };
}
