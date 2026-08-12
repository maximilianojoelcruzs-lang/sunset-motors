// Rasca y gana.
//
// Una tabla de premios con pesos: se saca un premio al azar y después se arma el cartón
// para que cuente esa historia. El cartón es la puesta en escena; el premio ya estaba
// decidido. Así funcionan los raspaditos de verdad — el cartón viene impreso de fábrica.
//
// Retorno al jugador: 92,00% exacto. Los raspaditos físicos pagan bastante menos (60–70%);
// los instantáneos en línea rondan el 90–95%. Se usa el segundo, que es más justo.
//
//   premio  peso     probabilidad   aporte al retorno
//   ------  -------  -------------  -----------------
//   nada     6.275     62,75%             0
//   x1       2.200     22,00%          22,00%
//   x2       1.000     10,00%          20,00%
//   x5         400      4,00%          20,00%
//   x10        100      1,00%          10,00%
//   x50         20      0,20%          10,00%
//   x200         5      0,05%          10,00%
//   ------  -------  -------------  -----------------
//            10.000    100,00%          92,00%

// Cada premio lleva su propio símbolo. Antes se deducía del índice y los dos premios más
// altos terminaban compartiendo el mismo, así que la tabla decía que 7-7-7 pagaba x50 y
// x200 a la vez.
export const PREMIOS = [
  { multiplicador: 0, peso: 6275, simbolo: null },
  { multiplicador: 1, peso: 2200, simbolo: '🍒' },
  { multiplicador: 2, peso: 1000, simbolo: '🍋' },
  { multiplicador: 5, peso: 400, simbolo: '🔔' },
  { multiplicador: 10, peso: 100, simbolo: '⭐' },
  { multiplicador: 50, peso: 20, simbolo: '💎' },
  { multiplicador: 200, peso: 5, simbolo: '7️⃣' },
];

const TOTAL_PESOS = PREMIOS.reduce((s, p) => s + p.peso, 0); // 10.000

export const RETORNO =
  PREMIOS.reduce((s, p) => s + p.peso * p.multiplicador, 0) / TOTAL_PESOS;

/** Todos los símbolos que pueden aparecer en un cartón. */
export const SIMBOLOS = PREMIOS.filter((p) => p.simbolo).map((p) => p.simbolo);

/** Entero al azar en [0, tope), sin sesgo: se descarta el sobrante. */
function alAzar(tope) {
  const max = Math.floor(0x100000000 / tope) * tope;
  const b = new Uint32Array(1);
  let v;
  do {
    crypto.getRandomValues(b);
    v = b[0];
  } while (v >= max);
  return v % tope;
}

function sacarPremio() {
  let n = alAzar(TOTAL_PESOS);
  for (const p of PREMIOS) {
    if (n < p.peso) return p.multiplicador;
    n -= p.peso;
  }
  return 0;
}

/**
 * Arma un cartón de 9 casillas coherente con el premio.
 *
 * Con premio: tres iguales del símbolo ganador, repartidas al azar, y el resto relleno sin
 * que se cuele otro trío por accidente. Sin premio: relleno con un máximo de dos iguales.
 */
function armarCarton(multiplicador) {
  const casillas = new Array(9).fill(null);

  if (multiplicador > 0) {
    // Cada premio tiene su símbolo: el cartón y la tabla dicen lo mismo.
    const ganador = PREMIOS.find((p) => p.multiplicador === multiplicador).simbolo;

    const posiciones = [];
    while (posiciones.length < 3) {
      const p = alAzar(9);
      if (!posiciones.includes(p)) posiciones.push(p);
    }
    posiciones.forEach((p) => (casillas[p] = ganador));

    // El relleno no puede repetir el ganador ni formar otro trío.
    const cuenta = {};
    for (let i = 0; i < 9; i++) {
      if (casillas[i]) continue;
      let s;
      do {
        s = SIMBOLOS[alAzar(SIMBOLOS.length)];
      } while (s === ganador || (cuenta[s] ?? 0) >= 2);
      cuenta[s] = (cuenta[s] ?? 0) + 1;
      casillas[i] = s;
    }
    return casillas;
  }

  // Sin premio: nadie llega a tres.
  const cuenta = {};
  for (let i = 0; i < 9; i++) {
    let s;
    do {
      s = SIMBOLOS[alAzar(SIMBOLOS.length)];
    } while ((cuenta[s] ?? 0) >= 2);
    cuenta[s] = (cuenta[s] ?? 0) + 1;
    casillas[i] = s;
  }
  return casillas;
}

/** @returns { multiplicador, premio, carton, gano } — premio incluye la apuesta. */
export function rascar(apuesta) {
  const multiplicador = sacarPremio();
  return {
    multiplicador,
    premio: apuesta * multiplicador,
    carton: armarCarton(multiplicador),
    gano: multiplicador > 0,
  };
}
