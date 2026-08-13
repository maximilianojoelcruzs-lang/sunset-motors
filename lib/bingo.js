// Bingo de 75 bolas. Es el único juego de la sala que se juega **entre varios**: todos
// comparten la misma ronda, las mismas bolas y el mismo bote.
//
//   Cartón: 5 columnas × 5 filas. B(1-15) I(16-30) N(31-45) G(46-60) O(61-75), centro libre.
//   Línea:  cualquiera de las 5 filas completa. El centro cuenta como marcado.
//   Bingo:  las 24 casillas marcadas.
//
// Se cantan bolas hasta que alguien hace bingo. El bote son los cartones vendidos menos la
// comisión de la casa, y se reparte 30% a la línea y 70% al bingo. Si hay varios ganadores
// se divide en partes iguales — como en un bingo de verdad.
//
// **La casa no compite**: no pone cartones ni gana por acertar. Se queda con el 5% del bote
// y el resto vuelve entero a la sala. Por eso este es el único juego donde lo que gana uno
// lo pierden los demás y no la casa.
//
// Módulo puro: ni almacén ni sesión. `evaluar()` es una función del cartón y las bolas, así
// que la ronda entera se puede recalcular y comprobar sin levantar nada.

export const BOLAS = 75;
export const COLUMNAS = 5;
export const FILAS = 5;
export const POR_COLUMNA = BOLAS / COLUMNAS; // 15

export const RETORNO = 0.95; // 5% para la casa
export const PARTE_LINEA = 0.3;
export const PARTE_BINGO = 0.7;

export const PRECIO_CARTON = 500;
export const MAX_CARTONES = 4;

/**
 * Cuánto dura la venta y cada cuánto se canta una bola.
 *
 * Un cartón de 24 números tarda **unas 73 bolas** en completarse — es la matemática del
 * bingo de 75, no una elección: por eso los bingos de verdad juegan líneas y figuras además
 * del cartón lleno. A 2 segundos la bola eso son dos minutos y medio de cantar; a 800 ms,
 * poco menos de un minuto, que es lo que aguanta la gente mirando.
 */
export const VENTA_MS = 45000;
export const RITMO_MS = 800;

export const LETRAS = ['B', 'I', 'N', 'G', 'O'];

/** En qué columna cae una bola: 1-15 en la B, 16-30 en la I, etc. */
export const columnaDe = (bola) => Math.floor((bola - 1) / POR_COLUMNA);

/** Entero de 0 a n-1 sin sesgo. */
function alAzar(n) {
  const tope = Math.floor(0x100000000 / n) * n;
  const b = new Uint32Array(1);
  let v;
  do {
    crypto.getRandomValues(b);
    v = b[0];
  } while (v >= tope);
  return v % n;
}

function barajar(lista) {
  const m = lista.slice();
  for (let i = m.length - 1; i > 0; i -= 1) {
    const j = alAzar(i + 1);
    [m[i], m[j]] = [m[j], m[i]];
  }
  return m;
}

/**
 * Un cartón. Se guarda por columnas, que es como se lee: `carton[c][f]`.
 * El centro (columna 2, fila 2) es `null` — la casilla libre.
 */
export function crearCarton() {
  return Array.from({ length: COLUMNAS }, (_, c) => {
    const desde = c * POR_COLUMNA + 1;
    const posibles = Array.from({ length: POR_COLUMNA }, (_, i) => desde + i);
    const columna = barajar(posibles).slice(0, FILAS);
    if (c === 2) columna[2] = null;
    return columna;
  });
}

/** El orden en que van a salir las 75 bolas. Se sortea entero al abrir la ronda. */
export const sortearBolas = () =>
  barajar(Array.from({ length: BOLAS }, (_, i) => i + 1));

const marcada = (numero, cantadas) => numero === null || cantadas.has(numero);

/** ¿Tiene alguna fila completa? */
export function tieneLinea(carton, cantadas) {
  for (let f = 0; f < FILAS; f += 1) {
    if (carton.every((columna) => marcada(columna[f], cantadas))) return true;
  }
  return false;
}

export const tieneBingo = (carton, cantadas) =>
  carton.every((columna) => columna.every((n) => marcada(n, cantadas)));

/**
 * En qué bola canta cada cartón. Devuelve el índice (0 = con la primera bola) o `null` si
 * no llega nunca — que con las 75 bolas no pasa, pero la ronda no siempre las canta todas.
 */
export function cuandoCanta(carton, orden) {
  const cantadas = new Set();
  let linea = null;
  for (let i = 0; i < orden.length; i += 1) {
    cantadas.add(orden[i]);
    if (linea === null && tieneLinea(carton, cantadas)) linea = i;
    if (tieneBingo(carton, cantadas)) return { linea, bingo: i };
  }
  return { linea, bingo: null };
}

/**
 * Resuelve la ronda entera a partir de los cartones y el orden de las bolas.
 *
 * Es una función pura de sus dos argumentos: la misma ronda da siempre el mismo resultado,
 * se calcule cuando se calcule. Eso es lo que permite avanzar la ronda "al leer" sin que
 * dependa de cuándo abrió alguien la página.
 */
export function resolver(cartones, orden) {
  const cantos = cartones.map((c) => ({ ...c, ...cuandoCanta(c.numeros, orden) }));

  const primeraLinea = cantos.reduce(
    (mejor, c) => (c.linea !== null && (mejor === null || c.linea < mejor) ? c.linea : mejor),
    null
  );
  const primerBingo = cantos.reduce(
    (mejor, c) => (c.bingo !== null && (mejor === null || c.bingo < mejor) ? c.bingo : mejor),
    null
  );

  return {
    // La ronda termina con el primer bingo: cantar más bolas no cambiaría nada.
    ultimaBola: primerBingo === null ? orden.length - 1 : primerBingo,
    linea: primeraLinea,
    bingo: primerBingo,
    ganadoresLinea: cantos.filter((c) => c.linea === primeraLinea && primeraLinea !== null),
    ganadoresBingo: cantos.filter((c) => c.bingo === primerBingo && primerBingo !== null),
  };
}

/**
 * Cómo se reparte el bote. Si nadie hace línea —pasa cuando alguien canta bingo con la misma
 * bola que haría su primera línea— esa parte se suma al bingo, y no se la queda la casa.
 */
export function repartir(cartones, resultado) {
  const bote = Math.round(cartones.length * PRECIO_CARTON * RETORNO);

  const hayLinea = resultado.ganadoresLinea.length > 0;
  const hayBingo = resultado.ganadoresBingo.length > 0;

  const paraLinea = hayLinea ? Math.round(bote * (hayBingo ? PARTE_LINEA : 1)) : 0;
  const paraBingo = hayBingo ? bote - paraLinea : 0;

  const premios = new Map();
  const sumar = (usuario, cuanto) =>
    premios.set(usuario, (premios.get(usuario) ?? 0) + cuanto);

  if (hayLinea) {
    const cada = Math.floor(paraLinea / resultado.ganadoresLinea.length);
    for (const c of resultado.ganadoresLinea) sumar(c.usuario, cada);
  }
  if (hayBingo) {
    const cada = Math.floor(paraBingo / resultado.ganadoresBingo.length);
    for (const c of resultado.ganadoresBingo) sumar(c.usuario, cada);
  }

  return { bote, paraLinea, paraBingo, premios };
}
