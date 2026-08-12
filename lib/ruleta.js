// Ruleta europea: 37 casillas, del 0 al 36, con un solo cero.
//
// La ventaja de la casa sale de una sola cosa: los pagos se calculan como si hubiera 36
// casillas, pero hay 37. Ese cero de más es todo el negocio.
//
//   Pleno (1 número):   paga 35 a 1. Probabilidad  1/37. Esperado = 36/37 = 0,9730
//   Caballo (2):        paga 17 a 1. Probabilidad  2/37. Esperado = 36/37 = 0,9730
//   Rojo (18):          paga  1 a 1. Probabilidad 18/37. Esperado = 36/37 = 0,9730
//
// Es decir: **2,70% de ventaja de la casa en todas las apuestas por igual**, que es lo que
// pasa en una ruleta europea de verdad. El pago sale de una sola fórmula, `pagaDe()`, y por
// eso ninguna apuesta puede quedar descuadrada respecto de las demás.
//
// Nadie "ajusta" nada: se saca un número al azar y se pagan los premios que correspondan.
// No hay forma de inclinar la mesa, ni hace falta — la ventaja ya está en los pagos.

export const CASILLAS = 37;
export const VENTAJA_CASA = 1 / 37; // 2,70%

/** Orden real de la rueda europea, para que la animación caiga donde debe. */
export const RUEDA = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1,
  20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];

const ROJOS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

export const esRojo = (n) => ROJOS.has(n);
export const color = (n) => (n === 0 ? 'verde' : esRojo(n) ? 'rojo' : 'negro');

/**
 * Lo que paga una apuesta que cubre `cuantos` números, «a 1».
 *
 * Es una sola fórmula para todas: 36/cuantos − 1. De ahí salen los 35 a 1 del pleno, los
 * 17 a 1 del caballo, los 2 a 1 de la docena. Si algún día alguien inventa una apuesta
 * nueva, sale bien sola — y no hay manera de que una pague distinto que las demás.
 */
export const pagaDe = (cuantos) => 36 / cuantos - 1;

// --- Apuestas exteriores: las de fuera del paño de números ---

const rango = (desde, hasta) =>
  Array.from({ length: hasta - desde + 1 }, (_, i) => desde + i);

export const EXTERIORES = {
  rojo: { etiqueta: 'Rojo', numeros: rango(1, 36).filter(esRojo) },
  negro: { etiqueta: 'Negro', numeros: rango(1, 36).filter((n) => !esRojo(n)) },
  par: { etiqueta: 'Par', numeros: rango(1, 36).filter((n) => n % 2 === 0) },
  impar: { etiqueta: 'Impar', numeros: rango(1, 36).filter((n) => n % 2 === 1) },
  falta: { etiqueta: '1 a 18', numeros: rango(1, 18) },
  pasa: { etiqueta: '19 a 36', numeros: rango(19, 36) },
  docena1: { etiqueta: '1ª docena', numeros: rango(1, 12) },
  docena2: { etiqueta: '2ª docena', numeros: rango(13, 24) },
  docena3: { etiqueta: '3ª docena', numeros: rango(25, 36) },
  columna1: { etiqueta: '1ª columna', numeros: rango(1, 36).filter((n) => n % 3 === 1) },
  columna2: { etiqueta: '2ª columna', numeros: rango(1, 36).filter((n) => n % 3 === 2) },
  columna3: { etiqueta: '3ª columna', numeros: rango(1, 36).filter((n) => n % 3 === 0) },
};

// --- Apuestas interiores: las que van sobre el paño ---
//
// Se generan todas las legales en vez de escribirlas a mano: 37 plenos, 60 caballos, 12
// calles, 22 cuadros, 11 seisenas y las del cero. Escritas a mano se olvida alguna, y peor,
// se cuela alguna que no existe en una mesa real.
//
// Cada una trae **dónde va la ficha en el paño**, en coordenadas de la rejilla. Eso es parte
// del juego, no de la pantalla: el sitio donde se pone la ficha es lo que define la apuesta
// en una mesa de verdad. La rejilla es:
//
//   columnas: 1 = el cero · 2 = el borde del cero · 3+2(c−1) = la columna c · el par de al lado, su borde
//   filas:    2, 4, 6 = las tres filas de números · 3, 5 = entre ellas · 7 = bajo la última · 8 = el borde
//
// El paño se dibuja acostado (12 columnas de 3), así que lo que en una mesa es una «fila» de
// tres números acá es una columna. La apuesta es la misma: la calle.

/** Columna del paño (1–12) y fila (1 arriba, 3 abajo) de un número. */
const columnaDe = (n) => Math.ceil(n / 3);
const filaDe = (n) => (n % 3 === 0 ? 1 : n % 3 === 2 ? 2 : 3);
/** El número que está en esa casilla del paño. */
const enCasilla = (col, fila) => 3 * col - (fila - 1);

const pista = (col, fila) => 1 + 2 * col; // pista de rejilla de la columna `col`

function construirInteriores() {
  const lista = [];
  const poner = (id, tipo, etiqueta, numeros, col, fila, span) =>
    lista.push({ id, tipo, etiqueta, numeros, col, fila, span });

  // El cero, con su casilla alta a la izquierda.
  poner('n0', 'pleno', 'Pleno al 0', [0], 1, 2, 5);

  for (let n = 1; n <= 36; n += 1) {
    poner(`n${n}`, 'pleno', `Pleno al ${n}`, [n], pista(columnaDe(n)), 2 * filaDe(n));
  }

  // Caballos verticales: dos números de la misma columna del paño.
  for (let n = 1; n <= 36; n += 1) {
    if (n % 3 === 0) continue; // el de arriba no tiene vecino encima
    poner(
      `c${n}-${n + 1}`,
      'caballo',
      `Caballo ${n} y ${n + 1}`,
      [n, n + 1],
      pista(columnaDe(n)),
      2 * filaDe(n) - 1
    );
  }

  // Caballos horizontales: el mismo sitio en columnas contiguas.
  for (let n = 1; n <= 33; n += 1) {
    poner(
      `c${n}-${n + 3}`,
      'caballo',
      `Caballo ${n} y ${n + 3}`,
      [n, n + 3],
      pista(columnaDe(n)) + 1,
      2 * filaDe(n)
    );
  }

  // Caballos con el cero, y los dos tríos: van pegados al cero.
  poner('c0-3', 'caballo', 'Caballo 0 y 3', [0, 3], 2, 2);
  poner('t0-2-3', 'trio', 'Trío 0, 2 y 3', [0, 2, 3], 2, 3);
  poner('c0-2', 'caballo', 'Caballo 0 y 2', [0, 2], 2, 4);
  poner('t0-1-2', 'trio', 'Trío 0, 1 y 2', [0, 1, 2], 2, 5);
  poner('c0-1', 'caballo', 'Caballo 0 y 1', [0, 1], 2, 6);
  poner('p0123', 'primeros', 'Los cuatro primeros', [0, 1, 2, 3], 2, 7);

  // Calles: los tres números de una columna del paño.
  for (let col = 1; col <= 12; col += 1) {
    const numeros = [enCasilla(col, 1), enCasilla(col, 2), enCasilla(col, 3)].sort(
      (a, b) => a - b
    );
    poner(`ca${col}`, 'calle', `Calle ${numeros.join(', ')}`, numeros, pista(col), 8);
  }

  // Cuadros: los cuatro que se tocan en una esquina.
  for (let col = 1; col <= 11; col += 1) {
    for (let fila = 1; fila <= 2; fila += 1) {
      const numeros = [
        enCasilla(col, fila),
        enCasilla(col, fila + 1),
        enCasilla(col + 1, fila),
        enCasilla(col + 1, fila + 1),
      ].sort((a, b) => a - b);
      poner(
        `q${numeros[0]}`,
        'cuadro',
        `Cuadro ${numeros.join(', ')}`,
        numeros,
        pista(col) + 1,
        2 * fila + 1
      );
    }
  }

  // Seisenas: dos calles seguidas.
  for (let col = 1; col <= 11; col += 1) {
    const numeros = [
      ...[1, 2, 3].map((f) => enCasilla(col, f)),
      ...[1, 2, 3].map((f) => enCasilla(col + 1, f)),
    ].sort((a, b) => a - b);
    poner(
      `s${col}`,
      'seisena',
      `Seisena ${numeros[0]} a ${numeros[5]}`,
      numeros,
      pista(col) + 1,
      8
    );
  }

  return lista;
}

export const INTERIORES = construirInteriores();

const PORID = new Map([
  ...INTERIORES.map((a) => [a.id, a]),
  ...Object.entries(EXTERIORES).map(([id, a]) => [id, { id, tipo: 'exterior', ...a }]),
]);

/**
 * Busca una apuesta por su identificador.
 *
 * El navegador manda **el sitio donde puso la ficha**, no la lista de números: así no hay
 * forma de inventarse un «caballo» de dos números que en una mesa de verdad no se tocan, ni
 * de pedir un pago que no corresponda.
 */
export const apuestaPorId = (id) => PORID.get(id) ?? null;

/**
 * Número al azar, 0–36, con `crypto` y sin sesgo.
 *
 * Un `% 37` sobre un byte tendría sesgo: 256 no es múltiplo de 37, así que los primeros
 * números saldrían un pelo más seguido. Se descartan los valores del sobrante en vez de
 * repartir el resto — es la forma correcta y cuesta nada.
 */
export function girar() {
  const tope = Math.floor(256 / CASILLAS) * CASILLAS; // 222
  const b = new Uint8Array(1);
  let v;
  do {
    crypto.getRandomValues(b);
    v = b[0];
  } while (v >= tope);
  return v % CASILLAS;
}

/**
 * Resuelve una apuesta contra el número que salió.
 * @returns { gano, premio, paga, etiqueta } — el premio incluye la apuesta devuelta.
 */
export function resolverApuesta({ id, monto, numero }) {
  const def = apuestaPorId(id);
  if (!def) return { error: 'Esa apuesta no existe.' };

  const paga = pagaDe(def.numeros.length);
  const gano = def.numeros.includes(numero);

  return {
    id,
    etiqueta: def.etiqueta,
    monto,
    paga,
    gano,
    premio: gano ? Math.round(monto * (paga + 1)) : 0,
  };
}
