// Vídeo póker — Jacks or Better con la tabla 9/6.
//
// Es el juego con mejor retorno de todo el casino: **99,5% con juego perfecto**. El 9/6 del
// nombre son los pagos del full y el color, que son justamente los que las máquinas de verdad
// recortan (8/5, 7/5…) para bajar el retorno sin que se note. Acá está la tabla buena.
//
//   Escalera real        x800
//   Escalera de color     x50
//   Póker                 x25
//   Full                   x9   <- el 9
//   Color                  x6   <- el 6
//   Escalera               x4
//   Trío                   x3
//   Doble pareja           x2
//   Pareja de J o mejor    x1   <- devuelve la apuesta, ni gana ni pierde
//
// Ese 99,5% es con juego perfecto: quién se queda con qué cartas lo decide la persona, y ahí
// es donde se pierde de verdad. Por eso el retorno depende del jugador y no solo de la tabla,
// al revés que en la ruleta o las tragamonedas.
//
// Módulo puro a propósito: no toca el almacén ni la sesión, así la mesa lo puede importar
// desde el navegador para pintar la tabla de pagos, y se puede probar sin levantar nada.

export const PALOS = ['♠', '♥', '♦', '♣'];
export const FIGURAS = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };

export const etiqueta = (carta) => `${FIGURAS[carta.valor] ?? carta.valor}${carta.palo}`;
export const esRoja = (carta) => carta.palo === '♥' || carta.palo === '♦';

/** De mejor a peor. El orden importa: `evaluar()` devuelve la primera que calce. */
export const MANOS = [
  { clave: 'real', nombre: 'Escalera real', paga: 800 },
  { clave: 'escalera-color', nombre: 'Escalera de color', paga: 50 },
  { clave: 'poker', nombre: 'Póker', paga: 25 },
  { clave: 'full', nombre: 'Full', paga: 9 },
  { clave: 'color', nombre: 'Color', paga: 6 },
  { clave: 'escalera', nombre: 'Escalera', paga: 4 },
  { clave: 'trio', nombre: 'Trío', paga: 3 },
  { clave: 'doble', nombre: 'Doble pareja', paga: 2 },
  { clave: 'jotas', nombre: 'Pareja de J o mejor', paga: 1 },
];

export const NADA = { clave: 'nada', nombre: 'Sin premio', paga: 0 };

const de = (clave) => MANOS.find((m) => m.clave === clave);

/** Entero de 0 a n-1 sin sesgo: se descartan los valores del último tramo incompleto. */
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

export function crearMazo() {
  const mazo = [];
  for (const palo of PALOS) {
    for (let valor = 2; valor <= 14; valor += 1) mazo.push({ valor, palo });
  }
  return mazo;
}

/** Fisher-Yates. Cada orden del mazo con la misma probabilidad. */
export function barajar(mazo) {
  const m = mazo.slice();
  for (let i = m.length - 1; i > 0; i -= 1) {
    const j = alAzar(i + 1);
    [m[i], m[j]] = [m[j], m[i]];
  }
  return m;
}

/**
 * Reparte cinco y devuelve también **el resto del mazo**. Guardar el resto es lo que hace que
 * el cambio sea honesto: las cartas del segundo reparto ya estaban decididas y en orden antes
 * de que la persona eligiera qué se queda.
 */
export function repartir() {
  const mazo = barajar(crearMazo());
  return { mano: mazo.slice(0, 5), mazo: mazo.slice(5) };
}

/** Cambia las cartas no marcadas por las siguientes del mazo guardado. */
export function cambiar(mano, mazo, seQueda) {
  let i = 0;
  const nueva = mano.map((carta, idx) => (seQueda.includes(idx) ? carta : mazo[i++]));
  return { mano: nueva, mazo: mazo.slice(i) };
}

export function evaluar(mano) {
  const valores = mano.map((c) => c.valor).sort((a, b) => a - b);
  const color = mano.every((c) => c.palo === mano[0].palo);

  const unicos = [...new Set(valores)];
  const corrida = unicos.length === 5 && unicos[4] - unicos[0] === 4;
  // El as vale 1 en la escalera baja A-2-3-4-5, y solo ahí.
  const ruedita = unicos.join() === '2,3,4,5,14';
  const escalera = corrida || ruedita;

  if (escalera && color) return unicos[0] === 10 ? de('real') : de('escalera-color');

  const repes = {};
  for (const v of valores) repes[v] = (repes[v] ?? 0) + 1;
  const grupos = Object.values(repes).sort((a, b) => b - a);

  if (grupos[0] === 4) return de('poker');
  if (grupos[0] === 3 && grupos[1] === 2) return de('full');
  if (color) return de('color');
  if (escalera) return de('escalera');
  if (grupos[0] === 3) return de('trio');
  if (grupos[0] === 2 && grupos[1] === 2) return de('doble');

  if (grupos[0] === 2) {
    const pareja = Number(Object.keys(repes).find((v) => repes[v] === 2));
    if (pareja >= 11) return de('jotas');
  }

  return NADA;
}

/**
 * Qué cartas forman la mano premiada. Las máquinas de verdad las marcan, y sin eso la
 * persona ve que le pagaron pero no por qué — sobre todo con doble pareja o pareja de J,
 * donde la carta que importa se pierde entre las otras.
 */
export function cartasQuePagan(mano, resultado) {
  const todas = [0, 1, 2, 3, 4];
  if (resultado.clave === 'nada') return [];

  // Escaleras, colores y full se arman con las cinco.
  const enteras = ['real', 'escalera-color', 'color', 'escalera', 'full'];
  if (enteras.includes(resultado.clave)) return todas;

  const repes = {};
  mano.forEach((c, i) => {
    (repes[c.valor] ??= []).push(i);
  });

  const cuantas = { poker: 4, trio: 3, doble: 2, jotas: 2 }[resultado.clave];
  return todas.filter((i) => repes[mano[i].valor].length === cuantas);
}
