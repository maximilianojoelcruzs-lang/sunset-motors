// Administra los usuarios directamente en la base de datos.
//
//   node scripts/usuarios.mjs listar
//   node scripts/usuarios.mjs crear <usuario> <clave> [--admin]
//   node scripts/usuarios.mjs clave <usuario> <clave-nueva>
//   node scripts/usuarios.mjs admin <usuario> si|no
//   node scripts/usuarios.mjs borrar <usuario>
//
// Sin variables de entorno trabaja sobre .datos/usuarios.json (tu computador). Con
// KV_REST_API_URL y KV_REST_API_TOKEN trabaja sobre la base real — así se crea el primer
// administrador de producción, que es el único que no puede crearse desde la app.
//
// Lee .env.local automáticamente si existe, para no tener que escribir las variables.

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
  // Sin .env.local no pasa nada: se trabaja contra el archivo local.
}

const { dondeGuarda } = await import('../lib/almacen.js');
const { listarUsuarios, crearUsuario, borrarUsuario, cambiarRol, cambiarClave } =
  await import('../lib/usuarios.js');

const [accion, ...resto] = process.argv.slice(2);
const banderas = resto.filter((a) => a.startsWith('--'));
const args = resto.filter((a) => !a.startsWith('--'));

// El rótulo tiene que nombrar el backend real: si miente, alguien cree que creó el
// administrador de producción cuando lo dejó en su disco, o al revés.
const rotulo = {
  supabase: 'la base de datos (Supabase)',
  redis: 'la base de datos (Redis)',
  archivo: '.datos/usuarios.json (local)',
}[dondeGuarda()];

const salir = (mensaje, codigo = 1) => {
  console.error(mensaje);
  process.exit(codigo);
};

const ayuda = `Uso:
  node scripts/usuarios.mjs listar
  node scripts/usuarios.mjs crear <usuario> <clave> [--admin]
  node scripts/usuarios.mjs clave <usuario> <clave-nueva>
  node scripts/usuarios.mjs admin <usuario> si|no
  node scripts/usuarios.mjs borrar <usuario>`;

switch (accion) {
  case 'listar': {
    const lista = await listarUsuarios();
    console.log(`Usuarios en ${rotulo}:`);
    if (!lista.length) {
      console.log('  (ninguno todavía — crea el primero con "crear ... --admin")');
      break;
    }
    for (const u of lista) {
      console.log(`  ${u.usuario}${u.admin ? '  [administrador]' : ''}`);
    }
    break;
  }

  case 'crear': {
    const [usuario, clave] = args;
    if (!usuario || !clave) salir(ayuda);

    // El primer usuario de una base vacía se crea administrador aunque no lo pidan. Un
    // taller cuyo único usuario no es admin no puede crear a nadie más ni ver el registro:
    // es un callejón sin salida. Además `npm run ... --admin` sin el "--" se come la
    // bandera, y ese error terminaba justo acá.
    const primero = (await listarUsuarios()).length === 0;
    const admin = banderas.includes('--admin') || primero;

    const { error, usuario: creado } = await crearUsuario(usuario, clave, admin);
    if (error) salir(`No se pudo crear: ${error}`);

    console.log(
      `Creado "${creado.usuario}"${creado.admin ? ' como administrador' : ''} en ${rotulo}.`
    );
    if (primero && !banderas.includes('--admin')) {
      console.log('(Es el primer usuario del taller, así que queda como administrador.)');
    }
    break;
  }

  case 'clave': {
    const [usuario, nueva] = args;
    if (!usuario || !nueva) salir(ayuda);
    const { error } = await cambiarClave(usuario, nueva);
    if (error) salir(`No se pudo cambiar: ${error}`);
    console.log(`Clave de "${usuario}" cambiada en ${rotulo}.`);
    break;
  }

  case 'admin': {
    const [usuario, valor] = args;
    if (!usuario || !['si', 'sí', 'no'].includes(valor)) salir(ayuda);
    const { error } = await cambiarRol(usuario, valor !== 'no');
    if (error) salir(`No se pudo cambiar: ${error}`);
    console.log(`"${usuario}" ${valor === 'no' ? 'ya no es' : 'ahora es'} administrador.`);
    break;
  }

  case 'borrar': {
    const [usuario] = args;
    if (!usuario) salir(ayuda);
    const { error } = await borrarUsuario(usuario);
    if (error) salir(`No se pudo borrar: ${error}`);
    console.log(`Borrado "${usuario}" de ${rotulo}.`);
    break;
  }

  default:
    salir(ayuda);
}
