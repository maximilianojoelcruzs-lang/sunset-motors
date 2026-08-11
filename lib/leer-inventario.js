// Convierte el texto que devuelve el OCR en una lista de { nombre, cantidad }.
//
// No sabemos cómo se ve exactamente el inventario de tu servidor, así que se prueban los
// formatos habituales en vez de asumir uno:
//
//   Kit de reparación x5      nombre al principio, cantidad al final
//   5x Kit de reparación      cantidad al principio
//   Kit de reparación   5     separados por espacios
//   Kit de reparación (5)     cantidad entre paréntesis
//   Kit de reparación         sin cantidad -> se asume 1
//
// Esta función es pura a propósito: el OCR es la parte impredecible, y al menos la lectura
// de lo que devuelve se puede probar sin imágenes.

/** Líneas que el OCR saca de la interfaz pero no son productos. */
const RUIDO = [
  /^inventar/i,
  /^bodega/i,
  /^almac[eé]n/i,
  /^peso/i,
  /^capacidad/i,
  /^total/i,
  /^buscar/i,
  /^cerrar/i,
  /^\W*$/,
  /^kg$/i,
];

const esRuido = (linea) => RUIDO.some((r) => r.test(linea));

/** Quita caracteres que el OCR inventa en los bordes y aprieta los espacios. */
const limpiar = (texto) =>
  texto
    .replace(/[|_©®™"'`~^<>{}[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const PATRONES = [
  // 5x Kit de reparación   /   5 x Kit
  { re: /^(\d{1,6})\s*[xX×]\s*(.+)$/, nombre: 2, cantidad: 1 },
  // Kit de reparación x5   /   Kit x 5
  { re: /^(.+?)\s*[xX×]\s*(\d{1,6})$/, nombre: 1, cantidad: 2 },
  // Kit de reparación (5)
  { re: /^(.+?)\s*[({[]\s*(\d{1,6})\s*[)}\]]$/, nombre: 1, cantidad: 2 },
  // Kit de reparación   5
  { re: /^(.+?)\s{1,}(\d{1,6})$/, nombre: 1, cantidad: 2 },
];

/**
 * @param texto  lo que devolvió el OCR, con saltos de línea
 * @returns      [{ nombre, cantidad }] en el orden en que aparecieron
 */
export function leerInventario(texto) {
  if (typeof texto !== 'string') return [];

  const encontrados = [];

  for (const cruda of texto.split(/\r?\n/)) {
    const linea = limpiar(cruda);
    if (!linea || linea.length < 2 || esRuido(linea)) continue;

    let nombre = linea;
    let cantidad = 1;

    for (const patron of PATRONES) {
      const coincide = linea.match(patron.re);
      if (!coincide) continue;

      const posibleNombre = limpiar(coincide[patron.nombre]);
      // Un nombre de una sola letra casi siempre es basura del OCR; mejor tratar la línea
      // entera como nombre que inventar un producto llamado "K".
      if (posibleNombre.length < 2) continue;

      nombre = posibleNombre;
      cantidad = parseInt(coincide[patron.cantidad], 10);
      break;
    }

    if (!nombre || nombre.length < 2 || esRuido(nombre)) continue;
    if (!Number.isFinite(cantidad) || cantidad < 1) cantidad = 1;

    encontrados.push({ nombre, cantidad });
  }

  return encontrados;
}
