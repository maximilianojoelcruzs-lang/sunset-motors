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
import { cambiar, leer, USUARIOS } from './almacen.js';

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

/**
 * Acceso al casino. Es una categoría aparte de `admin`, no un nivel más alto: hay gente que
 * solo entra al casino y nunca al taller. Un administrador tiene acceso a todo.
 */
export async function esCasino(usuario) {
  if (typeof usuario !== 'string') return false;
  const buscado = usuario.trim().toLowerCase();
  return (await listarUsuarios()).some(
    (u) => u.usuario.toLowerCase() === buscado && (u.casino === true || u.admin === true)
  );
}

/**
 * Solo casino: no tiene nada que hacer en las pantallas del taller.
 *
 * `taller` es lo que distingue al **mecánico que además entra al casino** del invitado que
 * solo va al casino. Solo significa algo cuando `casino` está puesto: un mecánico normal ni
 * siquiera ve el casino, así que da lo mismo lo que tenga acá.
 *
 * Va como bandera aparte y no cambiando el sentido de `casino` porque las cuentas que ya
 * existen no la traen: sin `taller`, un invitado del casino sigue siendo solo del casino,
 * exactamente como antes. Nadie gana acceso por un despliegue.
 */
export async function soloCasino(usuario) {
  if (typeof usuario !== 'string') return false;
  const buscado = usuario.trim().toLowerCase();
  const ficha = (await listarUsuarios()).find((u) => u.usuario.toLowerCase() === buscado);
  return Boolean(ficha?.casino) && !ficha?.admin && !ficha?.taller;
}

/** Puede usar las pantallas del taller: todos menos los invitados del casino. */
export async function esTaller(usuario) {
  return !(await soloCasino(usuario));
}

/**
 * Las tres puertas de alguien, de una sola lectura del almacén.
 *
 * Existe para que la barra sepa si enseñar el botón de cambiar de vista sin hacer tres
 * consultas por página. `casino` y `taller` son las dos vistas; `admin` no es una vista,
 * es lo que abre el panel.
 */
export async function accesosDe(usuario) {
  const { admin, casino, taller } = await puertasDe(usuario);
  return { admin, casino, taller };
}

/**
 * Lo mismo que `accesosDe()` **más si la cuenta todavía existe**, de la misma única lectura.
 *
 * `existe` es lo que hace que borrar a alguien lo eche de verdad. Antes las puertas del taller
 * se decidían con `soloCasino()`, que a una cuenta borrada responde `false` —no es del casino,
 * porque no es de nada— y la dejaba pasar: quien tuviera la pestaña abierta seguía usando la
 * calculadora, el tunning y la bodega hasta que su cookie caducara, que son 30 días.
 *
 * No cuesta ninguna consulta extra: la comprobación de siempre ya leía esta misma colección.
 */
export async function puertasDe(usuario) {
  const cerrado = { existe: false, suspendida: false, admin: false, casino: false, taller: false };
  if (typeof usuario !== 'string') return cerrado;

  const buscado = usuario.trim().toLowerCase();
  const ficha = (await listarUsuarios()).find((u) => u.usuario.toLowerCase() === buscado);
  if (!ficha) return cerrado;

  // Suspendida: la cuenta existe y guarda su historial, pero no abre ninguna puerta. Las tres
  // van en false a propósito, para que ninguna comprobación de más arriba pueda dejarla entrar
  // por descuido; el portero de `lib/servidor.js` mira `suspendida` para dar el mensaje justo.
  if (ficha.suspendida === true) {
    return { existe: true, suspendida: true, admin: false, casino: false, taller: false };
  }

  const admin = ficha.admin === true;
  return {
    existe: true,
    suspendida: false,
    admin,
    casino: admin || ficha.casino === true,
    taller: admin || !ficha.casino || ficha.taller === true,
  };
}

/**
 * Da o quita el casino.
 *
 * Al dárselo a alguien que hoy está en el taller se le deja **también** el taller. Si no,
 * añadir el casino a un mecánico lo echaría de la calculadora sin que nadie lo pidiera: la
 * bandera `taller` no existía cuando se creó su cuenta. Para dejar a alguien solo de casino
 * está `cambiarTaller(usuario, false)`, que es explícito.
 */
export async function cambiarCasino(usuario, casino) {
  const buscado = usuario.trim().toLowerCase();
  return cambiar(USUARIOS, (lista) => {
    const i = lista.findIndex((u) => u.usuario.toLowerCase() === buscado);
    if (i === -1) return { error: 'Ese usuario no existe.' };

    const eraDelTaller = !lista[i].casino;
    const copia = [...lista];
    copia[i] = {
      ...copia[i],
      casino: Boolean(casino),
      taller: casino && eraDelTaller ? true : Boolean(copia[i].taller),
    };
    return { lista: copia, valor: { ok: true } };
  });
}

/** Deja entrar al taller a alguien que tiene casino. Sin `casino` no cambia nada. */
export async function cambiarTaller(usuario, taller) {
  return cambiarBandera(usuario, 'taller', taller);
}

async function cambiarBandera(usuario, bandera, activo) {
  const buscado = usuario.trim().toLowerCase();
  return cambiar(USUARIOS, (lista) => {
    const i = lista.findIndex((u) => u.usuario.toLowerCase() === buscado);
    if (i === -1) return { error: 'Ese usuario no existe.' };

    const copia = [...lista];
    copia[i] = { ...copia[i], [bandera]: Boolean(activo) };
    return { lista: copia, valor: { ok: true } };
  });
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
  return cambiar(USUARIOS, (lista) => {
    const i = lista.findIndex((u) => u.usuario.toLowerCase() === buscado);
    if (i === -1) return { error: 'Ese usuario no existe.' };

    const copia = [...lista];
    copia[i] = { ...copia[i], discord: limpio || null };
    return { lista: copia, valor: { ok: true } };
  });
}

const NOMBRE_VALIDO = /^[a-z0-9._-]{2,24}$/;

export async function crearUsuario(usuario, clave, admin = false, casino = false, taller = false) {
  const limpio = typeof usuario === 'string' ? usuario.trim().toLowerCase() : '';

  if (!NOMBRE_VALIDO.test(limpio)) {
    return { error: 'El usuario debe tener entre 2 y 24 caracteres: letras, números, . _ -' };
  }
  if (typeof clave !== 'string' || clave.length < 8) {
    return { error: 'La clave debe tener al menos 8 caracteres.' };
  }

  // El hash se calcula antes: es lento (200.000 iteraciones) y no debe repetirse en cada
  // reintento. El «ya existe» se comprueba **dentro**, contra la lista de verdad: si no, dos
  // altas del mismo nombre a la vez pasaban las dos.
  const ficha = {
    ...(await fichaNueva(limpio, clave, admin)),
    casino: Boolean(casino),
    taller: Boolean(taller),
  };

  return cambiar(USUARIOS, (lista) => {
    if (lista.some((u) => u.usuario.toLowerCase() === limpio)) {
      return { error: 'Ya existe un usuario con ese nombre.' };
    }
    return { lista: [...lista, ficha], valor: { usuario: ficha } };
  });
}

export async function borrarUsuario(usuario) {
  const limpio = typeof usuario === 'string' ? usuario.trim().toLowerCase() : '';
  return cambiar(USUARIOS, (lista) => {
    const ficha = lista.find((u) => u.usuario.toLowerCase() === limpio);
    if (!ficha) return { error: 'Ese usuario no existe.' };

    // Sin un solo admin nadie puede volver a entrar al panel ni crear usuarios: la única
    // salida sería la línea de comandos. Mejor no dejar que ocurra. La cuenta va **dentro**
    // del cambio porque el último administrador tiene que contarse sobre la lista de verdad:
    // dos borrados a la vez podían dejar el taller sin ninguno.
    if (ficha.admin && lista.filter((u) => u.admin).length === 1) {
      return { error: 'Es el único administrador. Nombra otro antes de borrarlo.' };
    }

    return {
      lista: lista.filter((u) => u.usuario.toLowerCase() !== limpio),
      valor: { ok: true },
    };
  });
}

/** Da o quita el rol de administrador. */
export async function cambiarRol(usuario, admin) {
  const limpio = typeof usuario === 'string' ? usuario.trim().toLowerCase() : '';
  return cambiar(USUARIOS, (lista) => {
    const i = lista.findIndex((u) => u.usuario.toLowerCase() === limpio);

    if (i === -1) return { error: 'Ese usuario no existe.' };
    if (!admin && lista[i].admin && lista.filter((u) => u.admin).length === 1) {
      return { error: 'Es el único administrador. Nombra otro antes de quitarle el rol.' };
    }

    const copia = [...lista];
    copia[i] = { ...copia[i], admin: Boolean(admin) };
    return { lista: copia, valor: { usuario: copia[i] } };
  });
}

/**
 * Suspende o reactiva una cuenta.
 *
 * Es el punto medio entre dejar entrar y borrar: la cuenta sigue en la base con su historial y
 * su clave, y no abre ninguna puerta. Se hizo al cerrar el casino a los jugadores — las cuentas
 * que eran **solo casino** no tenían dónde ir, y quitarles la bandera las habría convertido en
 * mecánicos con acceso a la calculadora y a la bodega, que nadie pidió. Borrarlas era perder la
 * cuenta por un cierre que puede ser temporal.
 *
 * No deja suspender al último administrador activo, por lo mismo que `borrarUsuario()`: sin
 * ninguno, al panel no vuelve a entrar nadie salvo por la línea de comandos.
 */
export async function cambiarSuspension(usuario, suspendida) {
  const limpio = typeof usuario === 'string' ? usuario.trim().toLowerCase() : '';
  return cambiar(USUARIOS, (lista) => {
    const i = lista.findIndex((u) => u.usuario.toLowerCase() === limpio);
    if (i === -1) return { error: 'Ese usuario no existe.' };

    const activos = lista.filter((u) => u.admin && u.suspendida !== true);
    if (suspendida && lista[i].admin && activos.length === 1) {
      return { error: 'Es el único administrador activo. Nombra otro antes de suspenderlo.' };
    }

    const copia = [...lista];
    copia[i] = { ...copia[i], suspendida: Boolean(suspendida) };
    return { lista: copia, valor: { usuario: copia[i] } };
  });
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

/**
 * Cambia la clave de alguien, generando sal nueva.
 *
 * **Se reemplazan la sal y el hash, no la ficha entera.** Antes se escribía encima con una
 * ficha recién hecha, y `fichaNueva()` solo devuelve `{ usuario, sal, hash, admin }`: cambiar
 * la clave borraba `casino`, `taller` y `discord`. Un invitado del casino que cambiaba su clave
 * aparecía de golpe en la calculadora del taller y no podía volver al casino. Pasó de verdad.
 *
 * Cualquier bandera que se agregue a la ficha se conserva sola con este `...copia[i]`.
 */
export async function cambiarClave(usuario, clave) {
  if (typeof clave !== 'string' || clave.length < 8) {
    return { error: 'La clave debe tener al menos 8 caracteres.' };
  }

  const limpio = typeof usuario === 'string' ? usuario.trim().toLowerCase() : '';

  // De la ficha nueva solo interesan las credenciales; el resto de la persona ya está. Se
  // deriva fuera del cambio: son 200.000 iteraciones y un reintento no tiene por qué repetirlas.
  const { sal, hash } = await fichaNueva(limpio, clave);

  return cambiar(USUARIOS, (lista) => {
    const i = lista.findIndex((u) => u.usuario.toLowerCase() === limpio);
    if (i === -1) return { error: 'Ese usuario no existe.' };

    const copia = [...lista];
    copia[i] = { ...copia[i], sal, hash };
    return { lista: copia, valor: { ok: true } };
  });
}
