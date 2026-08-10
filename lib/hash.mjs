// Parámetros del hash de claves, en su propio archivo para que los use tanto la app
// (lib/usuarios.js) como el script que genera usuarios, sin duplicar números.
//
// Si alguna vez subes ITERACIONES, los hashes viejos dejan de validar: hay que
// regenerar cada usuario con scripts/usuario.mjs.

export const ITERACIONES = 200000;
export const LARGO = 256; // bits derivados
