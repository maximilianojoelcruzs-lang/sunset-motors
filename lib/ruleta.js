// Ruleta europea: 37 casillas, del 0 al 36, con un solo cero.
//
// La ventaja de la casa sale de una sola cosa: los pagos se calculan como si hubiera 36
// casillas, pero hay 37. Ese cero de más es todo el negocio.
//
//   Pleno:   paga 35 a 1. Probabilidad 1/37.  Esperado = 36/37 = 0,9730
//   Rojo:    paga  1 a 1. Probabilidad 18/37. Esperado = 36/37 = 0,9730
//   Docena:  paga  2 a 1. Probabilidad 12/37. Esperado = 36/37 = 0,9730
//
// Es decir: **2,70% de ventaja de la casa en todas las apuestas por igual**, que es lo que
// pasa en una ruleta europea de verdad. Con doble cero (americana) sería 5,26%; no lo usamos
// porque es peor para quien juega y no aporta nada.
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
 * Tipos de apuesta, con el pago que usa un casino real.
 *
 * `paga` es «a 1»: pleno paga 35 a 1, o sea que con 100 te llevas 3600 (3500 + tu apuesta).
 */
export const APUESTAS = {
  pleno: { paga: 35, etiqueta: 'Pleno', acierta: (n, v) => n === v },
  rojo: { paga: 1, etiqueta: 'Rojo', acierta: (n) => n !== 0 && esRojo(n) },
  negro: { paga: 1, etiqueta: 'Negro', acierta: (n) => n !== 0 && !esRojo(n) },
  par: { paga: 1, etiqueta: 'Par', acierta: (n) => n !== 0 && n % 2 === 0 },
  impar: { paga: 1, etiqueta: 'Impar', acierta: (n) => n !== 0 && n % 2 === 1 },
  falta: { paga: 1, etiqueta: '1 a 18', acierta: (n) => n >= 1 && n <= 18 },
  pasa: { paga: 1, etiqueta: '19 a 36', acierta: (n) => n >= 19 && n <= 36 },
  docena1: { paga: 2, etiqueta: '1ª docena', acierta: (n) => n >= 1 && n <= 12 },
  docena2: { paga: 2, etiqueta: '2ª docena', acierta: (n) => n >= 13 && n <= 24 },
  docena3: { paga: 2, etiqueta: '3ª docena', acierta: (n) => n >= 25 && n <= 36 },
  columna1: { paga: 2, etiqueta: '1ª columna', acierta: (n) => n !== 0 && n % 3 === 1 },
  columna2: { paga: 2, etiqueta: '2ª columna', acierta: (n) => n !== 0 && n % 3 === 2 },
  columna3: { paga: 2, etiqueta: '3ª columna', acierta: (n) => n !== 0 && n % 3 === 0 },
};

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
 * Resuelve una apuesta contra un número.
 * @returns { premio, gano, etiqueta }  premio incluye la apuesta devuelta.
 */
export function resolverApuesta({ tipo, valor, apuesta, numero }) {
  const def = APUESTAS[tipo];
  if (!def) return { error: 'Esa apuesta no existe.' };

  if (tipo === 'pleno') {
    const n = Math.round(Number(valor));
    if (!Number.isInteger(n) || n < 0 || n > 36) {
      return { error: 'Para un pleno elige un número del 0 al 36.' };
    }
    const gano = def.acierta(numero, n);
    return {
      gano,
      premio: gano ? apuesta * (def.paga + 1) : 0,
      etiqueta: `Pleno al ${n}`,
    };
  }

  const gano = def.acierta(numero);
  return {
    gano,
    premio: gano ? apuesta * (def.paga + 1) : 0,
    etiqueta: def.etiqueta,
  };
}
