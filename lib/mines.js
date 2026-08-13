// Mines: 25 casillas, unas cuantas con mina. Se destapan de a una y cada casilla limpia sube
// el multiplicador; se puede cobrar cuando se quiera. Una mina y se pierde todo.
//
// El pago **no es una tabla**: sale de la probabilidad de haber llegado hasta ahí.
//
//   probabilidad de destapar k limpias seguidas con m minas = C(25−m, k) / C(25, k)
//   pago(k) = RETORNO × C(25, k) / C(25−m, k)
//
// De ahí sale la propiedad que define este juego: **da igual dónde te plantes**. Cobrar en la
// primera casilla o en la vigésima devuelve el mismo 97% a la larga — lo único que cambia es
// cada cuánto ganas, exactamente como en un juego de crash.
//
// Y por lo mismo, el jugador no puede ganar nada eligiendo "bien" las casillas: todas las
// tapadas son iguales mientras no se destapen. No hay estrategia que mover.

export const CASILLAS = 25;
export const RETORNO = 0.97;

/** Cuántas minas se pueden poner. Con 24, queda una sola casilla limpia. */
export const MINAS = [1, 3, 5, 10, 24];

/**
 * Hasta dónde llega la escalera.
 *
 * Sin tope, con 10 minas destaparlas todas paga **x3.170.697**: matemáticamente correcto y
 * una bomba para una economía de fichas que reparte el encargado a mano. Al llegar acá la
 * partida se cobra sola.
 *
 * El tope **no cambia el retorno**: cada escalón sigue pagando lo que le toca por su
 * probabilidad, y todos siguen devolviendo el mismo 97%. Solo deja de haber escalones más
 * allá — que eran igual de buenos, no mejores.
 */
export const TOPE_PAGO = 1000;

/** C(n, k) exacto: n nunca pasa de 25, así que no se desborda nada. */
function combinatorio(n, k) {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 1; i <= k; i += 1) r = (r * (n - k + i)) / i;
  return Math.round(r);
}

/** Con cuánta probabilidad se destapan `k` casillas limpias seguidas. */
export function probabilidadDe(minas, k) {
  return combinatorio(CASILLAS - minas, k) / combinatorio(CASILLAS, k);
}

/**
 * Lo que paga plantarse con `k` casillas limpias destapadas. Con 0 no se puede cobrar: sería
 * llevarse el 97% de la apuesta sin haber jugado.
 */
export function pagoDe(minas, k) {
  if (k <= 0) return 0;
  const bruto = RETORNO / probabilidadDe(minas, k);
  return Math.round(bruto * 100) / 100;
}

/**
 * Cuántas casillas se pueden destapar como mucho: las limpias que haya, o hasta donde el
 * pago llegue al tope. Al llegar, la partida se cobra sola.
 */
export function maximasDe(minas) {
  const limpias = CASILLAS - minas;
  // El último escalón que **no** pasa el tope. Parar en el primero que lo pasa dejaría
  // premios del doble del tope, que es justo lo que se quería evitar.
  for (let k = 1; k <= limpias; k += 1) {
    if (pagoDe(minas, k) > TOPE_PAGO) return Math.max(1, k - 1);
  }
  return limpias;
}

/** La escalera de pagos, hasta el tope, para mostrarla en pantalla. */
export const escaleraDe = (minas) =>
  Array.from({ length: maximasDe(minas) }, (_, i) => ({
    limpias: i + 1,
    pago: pagoDe(minas, i + 1),
    probabilidad: probabilidadDe(minas, i + 1),
  }));

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

/**
 * Dónde están las minas. Se deciden **antes de la primera casilla** y no se tocan más: si se
 * sortearan al destapar, el juego podría decidir sobre la marcha que justo esa tenía mina.
 */
export function sembrar(minas) {
  const casillas = Array.from({ length: CASILLAS }, (_, i) => i);
  const puestas = [];
  for (let i = 0; i < minas; i += 1) {
    puestas.push(...casillas.splice(alAzar(casillas.length), 1));
  }
  return puestas.sort((a, b) => a - b);
}

export const esValido = (minas) => MINAS.includes(Math.round(Number(minas)));
