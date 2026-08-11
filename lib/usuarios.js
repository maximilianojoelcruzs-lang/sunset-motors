// Usuarios del taller. Viven en la base de datos, NO en este archivo: así el repositorio
// se puede publicar sin exponer ningún hash, y agregar gente no exige volver a desplegar.
//
// Cada ficha guardada es { usuario, sal, hash, admin }. La clave nunca se guarda: solo su
// hash PBKDF2-SHA256 con sal propia.
//
// Para crear el primero (la base parte vacía y sin usuarios nadie puede entrar):
//     node scripts/usuarios.mjs crear <usuario> <clave> --admin

// Las rutas llevan extensión a propósito: Node las exige al ejecutar scripts/usuarios.mjs
// directamente. Webpack acepta ambas formas, así que ésta sirve para los dos.
import { ITERACIONES, LARGO } from './hash.mjs';
import { leer, guardar, USUARIOS } from './almacen.js';

const deHex = (texto) =>
  Uint8Array.from(texto.match(/.{2}/g) ?? [], (par) => parseInt(par, 16));

const aHex = (bytes) =>
  [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');

export async function derivar(clave, salHex) {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(clave),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: deHex(salHex), iterations: ITERACIONES, hash: 'SHA-256' },
    material,
    LARGO
  );
  return aHex(bits);
}

/** Arma la ficha de un usuario nuevo, ya con la clave convertida en hash. */
export async function fichaNueva(usuario, clave, admin = false) {
  const sal = aHex(crypto.getRandomValues(new Uint8Array(16)));
  return { usuario, sal, hash: await derivar(clave, sal), admin: Boolean(admin) };
}

export const listarUsuarios = () => leer(USUARIOS);

/** Sin usuarios no puede entrar nadie; la pantalla de login lo dice en vez de callar. */
export async function hayUsuarios() {
  return (await listarUsuarios()).length > 0;
}

/** Los nombres, para los filtros del panel. */
export async function nombres() {
  return (await listarUsuarios()).map((u) => u.usuario);
}

/** Devuelve el nombre de usuario si las credenciales calzan; si no, null. */
export async function verificarUsuario(usuario, clave) {
  if (typeof usuario !== 'string' || typeof clave !== 'string') return null;

  const buscado = usuario.trim().toLowerCase();
  const ficha = (await listarUsuarios()).find((u) => u.usuario.toLowerCase() === buscado);

  // Sin ficha igual derivamos, con una sal de relleno, para que un usuario inexistente no
  // responda notoriamente más rápido que una clave equivocada.
  const sal = ficha?.sal ?? '00000000000000000000000000000000';
  const calculado = await derivar(clave, sal);

  if (!ficha) return null;
  return calculado === ficha.hash ? ficha.usuario : null;
}

/**
 * Se consulta contra la base en cada request en vez de guardarse en la cookie: quitarle
 * el rol a alguien surte efecto de inmediato, sin esperar a que caduque su sesión.
 */
export async function esAdmin(usuario) {
  if (typeof usuario !== 'string') return false;
  const buscado = usuario.trim().toLowerCase();
  return (await listarUsuarios()).some(
    (u) => u.usuario.toLowerCase() === buscado && u.admin === true
  );
}

/** El ID de Discord de alguien, para poder mencionarlo. Opcional. */
export async function discordDe(usuario) {
  if (typeof usuario !== 'string') return null;
  const buscado = usuario.trim().toLowerCase();
  const ficha = (await listarUsuarios()).find((u) => u.usuario.toLowerCase() === buscado);
  return ficha?.discord ?? null;
}

/** Un ID de Discord es un número largo; se guarda como texto para no perder precisión. */
export async function cambiarDiscord(usuario, discord) {
  const limpio = typeof discord === 'string' ? discord.trim() : '';
  if (limpio && !/^\d{15,25}$/.test(limpio)) {
    return { error: 'El ID de Discord son solo números (17 o 18 dígitos).' };
  }

  const buscado = usuario.trim().toLowerCase();
  const lista = await listarUsuarios();
  const i = lista.findIndex((u) => u.usuario.toLowerCase() === buscado);
  if (i === -1) return { error: 'Ese usuario no existe.' };

  const copia = [...lista];
  copia[i] = { ...copia[i], discord: limpio || null };
  await guardar(USUARIOS, copia);
  return { ok: true };
}

const NOMBRE_VALIDO = /^[a-z0-9._-]{2,24}$/;

export async function crearUsuario(usuario, clave, admin = false) {
  const limpio = typeof usuario === 'string' ? usuario.trim().toLowerCase() : '';

  if (!NOMBRE_VALIDO.test(limpio)) {
    return { error: 'El usuario debe tener entre 2 y 24 caracteres: letras, números, . _ -' };
  }
  if (typeof clave !== 'string' || clave.length < 8) {
    return { error: 'La clave debe tener al menos 8 caracteres.' };
  }

  const lista = await listarUsuarios();
  if (lista.some((u) => u.usuario.toLowerCase() === limpio)) {
    return { error: 'Ya existe un usuario con ese nombre.' };
  }

  const ficha = await fichaNueva(limpio, clave, admin);
  await guardar(USUARIOS, [...lista, ficha]);
  return { usuario: ficha };
}

export async function borrarUsuario(usuario) {
  const limpio = typeof usuario === 'string' ? usuario.trim().toLowerCase() : '';
  const lista = await listarUsuarios();
  const ficha = lista.find((u) => u.usuario.toLowerCase() === limpio);

  if (!ficha) return { error: 'Ese usuario no existe.' };

  // Sin un solo admin nadie puede volver a entrar al panel ni crear usuarios: la única
  // salida sería la línea de comandos. Mejor no dejar que ocurra.
  if (ficha.admin && lista.filter((u) => u.admin).length === 1) {
    return { error: 'Es el único administrador. Nombra otro antes de borrarlo.' };
  }

  await guardar(USUARIOS, lista.filter((u) => u.usuario.toLowerCase() !== limpio));
  return { ok: true };
}

/** Da o quita el rol de administrador. */
export async function cambiarRol(usuario, admin) {
  const limpio = typeof usuario === 'string' ? usuario.trim().toLowerCase() : '';
  const lista = await listarUsuarios();
  const i = lista.findIndex((u) => u.usuario.toLowerCase() === limpio);

  if (i === -1) return { error: 'Ese usuario no existe.' };
  if (!admin && lista[i].admin && lista.filter((u) => u.admin).length === 1) {
    return { error: 'Es el único administrador. Nombra otro antes de quitarle el rol.' };
  }

  const copia = [...lista];
  copia[i] = { ...copia[i], admin: Boolean(admin) };
  await guardar(USUARIOS, copia);
  return { usuario: copia[i] };
}

/**
 * Cambio de clave hecho por la propia persona. Exige la clave actual: sin eso, cualquiera
 * que pille una sesión abierta podría cambiarla y dejar fuera al dueño de la cuenta.
 */
export async function cambiarClavePropia(usuario, actual, nueva) {
  if (!(await verificarUsuario(usuario, actual))) {
    return { error: 'Tu clave actual no es correcta.' };
  }
  if (typeof nueva !== 'string' || nueva.length < 8) {
    return { error: 'La clave nueva debe tener al menos 8 caracteres.' };
  }
  if (nueva === actual) {
    return { error: 'La clave nueva es igual a la actual.' };
  }
  return cambiarClave(usuario, nueva);
}

/** Cambia la clave de alguien, generando sal nueva. */
export async function cambiarClave(usuario, clave) {
  if (typeof clave !== 'string' || clave.length < 8) {
    return { error: 'La clave debe tener al menos 8 caracteres.' };
  }

  const limpio = typeof usuario === 'string' ? usuario.trim().toLowerCase() : '';
  const lista = await listarUsuarios();
  const i = lista.findIndex((u) => u.usuario.toLowerCase() === limpio);
  if (i === -1) return { error: 'Ese usuario no existe.' };

  const copia = [...lista];
  copia[i] = { ...(await fichaNueva(copia[i].usuario, clave, copia[i].admin)) };
  await guardar(USUARIOS, copia);
  return { ok: true };
}
