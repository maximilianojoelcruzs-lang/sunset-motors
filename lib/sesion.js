// Sesión sin base de datos: la cookie lleva el usuario firmado con HMAC-SHA256.
// Usa Web Crypto, así que corre igual en el middleware (Edge) y en los route handlers.
//
// La llave de firma es SUNSET_SECRETO, aparte de las claves de los usuarios: así los
// hashes de lib/usuarios.js pueden vivir en el repo sin que nadie pueda fabricarse
// una cookie válida. Cambiar el secreto cierra todas las sesiones abiertas de golpe.

const COD = new TextEncoder();
const DEC = new TextDecoder();

export const COOKIE = 'sunset_sesion';
export const HORAS = 12;

/** Llave para firmar cookies. En dev cae a un valor fijo; en producción no hay respaldo. */
export function secretoFirma() {
  const desdeEntorno = process.env.SUNSET_SECRETO;
  if (desdeEntorno) return desdeEntorno;
  return process.env.NODE_ENV === 'production' ? null : 'secreto-solo-para-desarrollo';
}

const aB64u = (bytes) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

const deB64u = (texto) => {
  const b64 = texto.replace(/-/g, '+').replace(/_/g, '/');
  const relleno = '='.repeat((4 - (b64.length % 4)) % 4);
  return Uint8Array.from(atob(b64 + relleno), (c) => c.charCodeAt(0));
};

async function llave() {
  const secreto = secretoFirma();
  if (!secreto) return null;
  return crypto.subtle.importKey(
    'raw',
    COD.encode(secreto),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

/** Arma el valor de la cookie para un usuario ya verificado. */
export async function firmarSesion(usuario) {
  const k = await llave();
  if (!k) return null;
  const cuerpo = aB64u(
    COD.encode(JSON.stringify({ u: usuario, exp: Date.now() + HORAS * 3600 * 1000 }))
  );
  const firma = await crypto.subtle.sign('HMAC', k, COD.encode(cuerpo));
  return `${cuerpo}.${aB64u(firma)}`;
}

/** Devuelve { usuario } si la cookie es legítima y no caducó; si no, null. */
export async function leerSesion(token) {
  if (!token) return null;
  const [cuerpo, firma] = token.split('.');
  if (!cuerpo || !firma) return null;

  const k = await llave();
  if (!k) return null;

  try {
    const valida = await crypto.subtle.verify('HMAC', k, deB64u(firma), COD.encode(cuerpo));
    if (!valida) return null;

    const { u, exp } = JSON.parse(DEC.decode(deB64u(cuerpo)));
    if (!u || !exp || Date.now() > exp) return null;
    return { usuario: u };
  } catch {
    return null;
  }
}
