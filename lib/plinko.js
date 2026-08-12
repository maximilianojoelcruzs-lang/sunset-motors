// Plinko: la bolita cae por 12 filas de clavos y cada choque la manda a un lado o al otro.
//
// No hay nada que "dirigir": cada rebote es una moneda al aire, y por eso las casillas del
// centro se llenan y las de los extremos casi nunca salen. Es una **binomial**: la casilla
// número k tiene probabilidad C(12,k)/4096.
//
//   casilla:  0     1     2     3     4     5     6     5     4     3     2     1     0
//   de 4096:  1    12    66   220   495   792   924   792   495   220    66    12     1
//   o sea: la del medio sale el 22,6% de las veces y una de las puntas 1 de cada 4.096
//
// Los multiplicadores de las puntas son enormes justamente porque casi nunca caen ahí. La
// ventaja de la casa está en la tabla, no en el rebote: `retornoDe()` la calcula exacto
// sumando probabilidad × pago, y es lo que se muestra en pantalla. Si tocas un número, la
// pantalla enseña el retorno nuevo sola.

export const FILAS = 12;
export const CASILLAS = FILAS + 1;

/** Cuántas bolitas se pueden soltar de una vez. Cada una cuesta la apuesta entera. */
export const PUÑADOS = [1, 3, 5, 10];
export const MAX_BOLITAS = PUÑADOS[PUÑADOS.length - 1];

/** Combinatorio C(n, k) exacto: n nunca pasa de 12, así que no se desborda nada. */
function combinatorio(n, k) {
  let r = 1;
  for (let i = 1; i <= k; i += 1) r = (r * (n - k + i)) / i;
  return Math.round(r);
}

/** Cuántas de las 4.096 caídas terminan en cada casilla. */
export const FORMAS = Array.from({ length: CASILLAS }, (_, k) => combinatorio(FILAS, k));
const TOTAL = 2 ** FILAS;

export const probabilidadDe = (casilla) => FORMAS[casilla] / TOTAL;

export const RETORNO = 0.97; // 3% para la casa, igual que el resto de la sala

/**
 * Los pagos **se calculan**, no se escriben a mano.
 *
 *   pago(k) ∝ (1 / probabilidad(k)) ^ dureza
 *
 * `dureza` es lo único que cambia entre las tres tablas: con 0 todas las casillas pagarían
 * igual y con 1 cada casilla devolvería exactamente lo mismo a la larga (el plinko más
 * salvaje posible). Entremedio salen las tres de siempre. Después se escala todo para que
 * el retorno sea el mismo en las tres — que es el punto: **elegir riesgo no cambia cuánto
 * se pierde a la larga, solo cómo se pierde.**
 *
 * A mano esto se descuadra sin que nadie lo note: la primera versión de la tabla alta
 * pagaba 103% y la casa perdía plata en cada bolita.
 */
function tablaDe(dureza) {
  const crudos = FORMAS.map((_, k) => (1 / probabilidadDe(k)) ** dureza);
  const bruto = crudos.reduce((s, m, k) => s + probabilidadDe(k) * m, 0);
  const escala = RETORNO / bruto;
  // Dos decimales: es lo que se puede leer en una casilla, y lo que se paga de verdad.
  return crudos.map((m) => Math.round(m * escala * 100) / 100);
}

/**
 * Tres tablas del mismo retorno y distinto carácter: la baja casi nunca te deja sin nada,
 * la alta paga cientos de veces en la punta y te vacía en el medio. Es la misma elección
 * que ofrece cualquier plinko de verdad.
 */
export const TABLAS = {
  bajo: { nombre: 'Bajo', lema: 'Casi siempre algo, nunca mucho', pagos: tablaDe(0.35) },
  medio: { nombre: 'Medio', lema: 'El equilibrio de siempre', pagos: tablaDe(0.6) },
  alto: { nombre: 'Alto', lema: 'O la punta, o nada', pagos: tablaDe(0.95) },
};

/** Retorno real de una tabla, ya con los pagos redondeados. Es lo que se muestra. */
export function retornoDe(riesgo) {
  const { pagos } = TABLAS[riesgo];
  return pagos.reduce((s, pago, k) => s + probabilidadDe(k) * pago, 0);
}

/** Un bit sin sesgo por cada clavo. Cada rebote es una moneda al aire y nada más. */
function caer() {
  const bytes = new Uint8Array(FILAS);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b & 1);
}

/**
 * Suelta la bolita.
 * @returns { camino, casilla, multiplicador, premio } — `camino` es 0 izquierda, 1 derecha,
 * y es lo que el navegador anima. El premio incluye la apuesta, como en el resto del casino.
 */
export function soltar(apuesta, riesgo) {
  const tabla = TABLAS[riesgo];
  if (!tabla) return { error: 'Ese nivel de riesgo no existe.' };

  const camino = caer();
  const casilla = camino.reduce((s, paso) => s + paso, 0);
  const multiplicador = tabla.pagos[casilla];

  return {
    camino,
    casilla,
    multiplicador,
    premio: Math.round(apuesta * multiplicador),
  };
}

/**
 * Suelta un puñado de bolitas de una vez. Cada una es independiente de las demás —ninguna
 * "compensa" a otra— y cada una cuesta la apuesta completa.
 */
export function soltarVarias(apuesta, riesgo, cuantas) {
  if (!TABLAS[riesgo]) return { error: 'Ese nivel de riesgo no existe.' };

  const n = Math.round(Number(cuantas));
  if (!PUÑADOS.includes(n)) {
    return { error: `Se sueltan de a ${PUÑADOS.join(', ')} bolitas.` };
  }

  const tiradas = Array.from({ length: n }, () => soltar(apuesta, riesgo));
  return {
    tiradas,
    bolitas: n,
    apuestaTotal: apuesta * n,
    premio: tiradas.reduce((s, t) => s + t.premio, 0),
  };
}
