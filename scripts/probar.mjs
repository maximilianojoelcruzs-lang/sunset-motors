// Comprueba la conexión a la base de datos, desde tu computador y opcionalmente desde el
// sitio publicado.
//
//   npm run probar
//   npm run probar https://tu-sitio.vercel.app
//
// Es de solo lectura: no crea, no borra y no modifica nada.

import { readFile } from 'node:fs/promises';

// Cargar .env.local antes de importar nada que mire process.env.
try {
  const texto = await readFile('.env.local', 'utf8');
  for (const linea of texto.split('\n')) {
    const limpia = linea.trim();
    if (!limpia || limpia.startsWith('#')) continue;
    const corte = limpia.indexOf('=');
    if (corte === -1) continue;
    const nombre = limpia.slice(0, corte).trim();
    const valor = limpia.slice(corte + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[nombre]) process.env[nombre] = valor;
  }
} catch {
  // Sin .env.local no pasa nada: se prueba contra el archivo local.
}

const { dondeGuarda, leer, USUARIOS, TURNOS } = await import('../lib/almacen.js');

const ok = (t) => console.log(`  \x1b[32m✓\x1b[0m ${t}`);
const mal = (t) => console.log(`  \x1b[31m✗\x1b[0m ${t}`);
const nota = (t) => console.log(`    \x1b[90m${t}\x1b[0m`);

let problemas = 0;

// ---------- 1. Desde este computador ----------

console.log('\nDESDE ESTE COMPUTADOR');

const backend = dondeGuarda();
const nombreBackend = {
  supabase: 'Supabase',
  redis: 'Redis',
  archivo: 'archivo local (.datos/)',
}[backend];

if (backend === 'archivo') {
  mal(`Almacén: ${nombreBackend}`);
  nota('No hay variables de base de datos. Revisa que .env.local tenga SUPABASE_URL');
  nota('y SUPABASE_SERVICE_ROLE_KEY, y que estés parado en la carpeta del proyecto.');
  problemas++;
} else {
  ok(`Almacén: ${nombreBackend}`);
}

try {
  const inicio = Date.now();
  const usuarios = await leer(USUARIOS);
  const turnos = await leer(TURNOS);
  const ms = Date.now() - inicio;

  ok(`Lectura correcta en ${ms} ms`);

  const admins = usuarios.filter((u) => u.admin).map((u) => u.usuario);
  if (!usuarios.length) {
    mal('No hay ningún usuario creado');
    nota('Créalo con: npm run usuarios crear <usuario> <clave> -- --admin');
    problemas++;
  } else if (!admins.length) {
    mal(`${usuarios.length} usuario(s), pero ninguno es administrador`);
    nota('Arréglalo con: npm run usuarios admin <usuario> si');
    problemas++;
  } else {
    ok(`${usuarios.length} usuario(s), ${admins.length} administrador(es): ${admins.join(', ')}`);
  }

  ok(`${turnos.length} turno(s) registrado(s)`);
} catch (e) {
  mal(`No se pudo leer: ${e.message}`);
  problemas++;
}

// ---------- 2. Desde el sitio publicado ----------

const sitio = process.argv[2];

if (sitio) {
  const base = sitio.replace(/\/+$/, '');
  console.log(`\nDESDE EL SITIO PUBLICADO (${base})`);

  try {
    // Un usuario que no existe: la respuesta delata en qué estado está el servidor,
    // sin necesidad de conocer ninguna clave real.
    const r = await fetch(`${base}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario: 'zzz-no-existe-zzz', clave: 'zzz-no-existe-zzz' }),
    });
    const cuerpo = await r.json().catch(() => ({}));

    if (r.status === 401) {
      ok('El sitio está leyendo la base de datos y ve tus usuarios');
      nota('Ya puedes entrar con tu usuario y clave.');
    } else if (r.status === 503) {
      mal('El sitio NO está viendo tus usuarios');
      nota(cuerpo.almacen === 'archivo'
        ? 'Está guardando en archivo local: faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY'
        : 'Está conectado a una base, pero vacía: ¿apunta a otro proyecto de Supabase?');
      nota('Revisa Vercel → Settings → Environment Variables, y vuelve a desplegar.');
      problemas++;
    } else if (r.status === 500 && /SUNSET_SECRETO/.test(cuerpo.error ?? '')) {
      mal('Falta SUNSET_SECRETO en el servidor');
      nota('Agrégala en Vercel → Settings → Environment Variables, y vuelve a desplegar.');
      problemas++;
    } else {
      mal(`Respuesta inesperada (${r.status}): ${cuerpo.error ?? '(sin mensaje)'}`);
      problemas++;
    }
  } catch (e) {
    mal(`No se pudo llegar al sitio: ${e.message}`);
    nota('¿La dirección está bien escrita, con https:// adelante?');
    problemas++;
  }
} else {
  console.log('\n\x1b[90mPara probar también el sitio publicado:');
  console.log('  npm run probar https://tu-sitio.vercel.app\x1b[0m');
}

console.log(
  problemas === 0
    ? '\n\x1b[32mTodo en orden.\x1b[0m\n'
    : `\n\x1b[31m${problemas} problema(s).\x1b[0m Revisa las notas de arriba.\n`
);

process.exit(problemas === 0 ? 0 : 1);
