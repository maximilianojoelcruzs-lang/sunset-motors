// Tragamonedas de tres rodillos, una línea de pago.
//
// Los rodillos llevan **pesos**, que es como funcionan las máquinas de verdad: el 7 no es
// raro porque el programa haga trampa al final, sino porque hay pocos sietes en la cinta.
// Se sortea cada rodillo por separado y se paga lo que salga.
//
//   símbolo  peso   probabilidad por rodillo
//   🍒        30           30%
//   🍋        25           25%
//   🔔        20           20%
//   ⭐        15           15%
//   💎         8            8%
//   7️⃣         2            2%
//
// Se paga el trío en línea, y además dos cerezas exactas devuelven la apuesta — eso sube
// la frecuencia de premio de un 5,5% a un 24%, que es lo que hace que la máquina se sienta
// viva en vez de muerta. Retorno total: ~94,3%, dentro del rango real (92–96%).

export const RODILLO = [
  { simbolo: '🍒', peso: 30, paga3: 8 },
  { simbolo: '🍋', peso: 25, paga3: 12 },
  { simbolo: '🔔', peso: 20, paga3: 20 },
  { simbolo: '⭐', peso: 15, paga3: 40 },
  { simbolo: '💎', peso: 8, paga3: 100 },
  { simbolo: '7️⃣', peso: 2, paga3: 500 },
];

const TOTAL = RODILLO.reduce((s, r) => s + r.peso, 0); // 100

/** Dos cerezas exactas devuelven lo apostado: el premio de consuelo. */
export const CEREZA = '🍒';
export const PAGA_DOS_CEREZAS = 1;

/** Retorno teórico exacto, calculado de la tabla. Se muestra en pantalla. */
export function retornoTeorico() {
  let rtp = 0;
  for (const r of RODILLO) {
    const p = r.peso / TOTAL;
    rtp += p ** 3 * r.paga3;
  }
  const pCereza = RODILLO.find((r) => r.simbolo === CEREZA).peso / TOTAL;
  // Exactamente dos cerezas: tres formas de colocarlas.
  rtp += 3 * pCereza ** 2 * (1 - pCereza) * PAGA_DOS_CEREZAS;
  return rtp;
}

/** Un rodillo, sin sesgo. */
function girarRodillo() {
  const max = Math.floor(0x100000000 / TOTAL) * TOTAL;
  const b = new Uint32Array(1);
  let v;
  do {
    crypto.getRandomValues(b);
    v = b[0];
  } while (v >= max);

  let n = v % TOTAL;
  for (const r of RODILLO) {
    if (n < r.peso) return r.simbolo;
    n -= r.peso;
  }
  return RODILLO[0].simbolo;
}

/** @returns { simbolos, premio, multiplicador, linea } — premio incluye la apuesta. */
export function girar(apuesta) {
  const simbolos = [girarRodillo(), girarRodillo(), girarRodillo()];

  const trio = simbolos[0] === simbolos[1] && simbolos[1] === simbolos[2];
  if (trio) {
    const def = RODILLO.find((r) => r.simbolo === simbolos[0]);
    return {
      simbolos,
      multiplicador: def.paga3,
      premio: apuesta * def.paga3,
      linea: `Trío de ${def.simbolo}`,
    };
  }

  const cerezas = simbolos.filter((s) => s === CEREZA).length;
  if (cerezas === 2) {
    return {
      simbolos,
      multiplicador: PAGA_DOS_CEREZAS,
      premio: apuesta * PAGA_DOS_CEREZAS,
      linea: 'Dos cerezas',
    };
  }

  return { simbolos, multiplicador: 0, premio: 0, linea: null };
}
