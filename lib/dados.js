// Dados: Sic Bo, tres dados de seis caras.
//
// Es un juego de casino real y se resuelve en una sola tirada, así que encaja con el motor
// que ya existe. Los pagos son los de una mesa de verdad, con sus ventajas de casa reales
// —que varían mucho entre apuestas, y eso es parte del juego:
//
//   Pequeño / Grande / Par / Impar   1:1     ventaja  2,78%   (el triple hace perder)
//   Cualquier triple                30:1     ventaja 13,89%
//   Triple exacto                  180:1     ventaja 16,20%
//   Total exacto                  varía      ventaja  9,7% a 18,98%
//
// Las apuestas sencillas son las buenas; las de triple pagan mucho y valen poco. Igual que
// en la mesa real, y por eso se muestra la ventaja de cada una en pantalla.

export const CARAS = 6;

/** Combinaciones de 3 dados que suman cada total, sobre 216 posibles. */
const FORMAS_TOTAL = {
  3: 1, 4: 3, 5: 6, 6: 10, 7: 15, 8: 21, 9: 25, 10: 27,
  11: 27, 12: 25, 13: 21, 14: 15, 15: 10, 16: 6, 17: 3, 18: 1,
};

/** Pagos reales de una mesa de Sic Bo para el total exacto. */
const PAGA_TOTAL = {
  4: 60, 17: 60,
  5: 30, 16: 30,
  6: 17, 15: 17,
  7: 12, 14: 12,
  8: 8, 13: 8,
  9: 6, 12: 6,
  10: 6, 11: 6,
};

const esTriple = (d) => d[0] === d[1] && d[1] === d[2];

export const APUESTAS = {
  pequeno: {
    etiqueta: 'Pequeño (4-10)',
    paga: 1,
    ventaja: 2.78,
    acierta: (d, suma) => !esTriple(d) && suma >= 4 && suma <= 10,
  },
  grande: {
    etiqueta: 'Grande (11-17)',
    paga: 1,
    ventaja: 2.78,
    acierta: (d, suma) => !esTriple(d) && suma >= 11 && suma <= 17,
  },
  par: {
    etiqueta: 'Par',
    paga: 1,
    ventaja: 2.78,
    acierta: (d, suma) => !esTriple(d) && suma % 2 === 0,
  },
  impar: {
    etiqueta: 'Impar',
    paga: 1,
    ventaja: 2.78,
    acierta: (d, suma) => !esTriple(d) && suma % 2 === 1,
  },
  triple: {
    etiqueta: 'Cualquier triple',
    paga: 30,
    ventaja: 13.89,
    acierta: (d) => esTriple(d),
  },
  tripleExacto: {
    etiqueta: 'Triple exacto',
    paga: 180,
    ventaja: 16.2,
    acierta: (d, suma, valor) => esTriple(d) && d[0] === valor,
  },
  total: {
    etiqueta: 'Total exacto',
    ventaja: null, // depende del número
    acierta: (d, suma, valor) => suma === valor,
  },
};

/** Ventaja de la casa de un total, para mostrarla en la mesa. */
export function ventajaTotal(n) {
  const formas = FORMAS_TOTAL[n];
  const paga = PAGA_TOTAL[n];
  if (!formas || !paga) return null;
  return Number((100 - ((paga + 1) * formas * 100) / 216).toFixed(2));
}

export const TOTALES = Object.keys(PAGA_TOTAL)
  .map(Number)
  .sort((a, b) => a - b)
  .map((n) => ({ n, paga: PAGA_TOTAL[n], ventaja: ventajaTotal(n) }));

/** Un dado, sin sesgo: 6 no divide a 256, así que se descarta el sobrante. */
function dado() {
  const tope = Math.floor(256 / CARAS) * CARAS; // 252
  const b = new Uint8Array(1);
  let v;
  do {
    crypto.getRandomValues(b);
    v = b[0];
  } while (v >= tope);
  return (v % CARAS) + 1;
}

export const tirar = () => [dado(), dado(), dado()];

/** @returns { gano, premio, etiqueta } — premio incluye la apuesta. */
export function resolverApuesta({ tipo, valor, apuesta, dados }) {
  const def = APUESTAS[tipo];
  if (!def) return { error: 'Esa apuesta no existe.' };

  const suma = dados[0] + dados[1] + dados[2];

  if (tipo === 'total') {
    const n = Math.round(Number(valor));
    if (!PAGA_TOTAL[n]) return { error: 'Ese total no se puede apostar.' };
    const gano = suma === n;
    return {
      gano,
      premio: gano ? apuesta * (PAGA_TOTAL[n] + 1) : 0,
      etiqueta: `Total ${n}`,
    };
  }

  if (tipo === 'tripleExacto') {
    const n = Math.round(Number(valor));
    if (!Number.isInteger(n) || n < 1 || n > 6) {
      return { error: 'Para un triple exacto elige un número del 1 al 6.' };
    }
    const gano = def.acierta(dados, suma, n);
    return {
      gano,
      premio: gano ? apuesta * (def.paga + 1) : 0,
      etiqueta: `Triple de ${n}`,
    };
  }

  const gano = def.acierta(dados, suma);
  return {
    gano,
    premio: gano ? apuesta * (def.paga + 1) : 0,
    etiqueta: def.etiqueta,
  };
}
