// Aviator: el avión despega, el multiplicador sube, y en algún momento se va. Quien se
// retira antes cobra lo que marcaba; quien no, pierde la apuesta.
//
// El punto en que se va **se sortea antes de despegar** y no se toca más. La distribución
// es la de todos los juegos de este tipo:
//
//   P(el avión llegue a x) = RETORNO / x
//
// De ahí sale lo bonito de este juego: **da igual a qué multiplicador te retires**. Retirarse
// en 1,50 acierta el 64,7% de las veces y paga 1,5; retirarse en 10 acierta el 9,7% y paga 10.
// Los dos devuelven el mismo 97%. No hay estrategia que cambie el margen, y por eso tampoco
// hace falta esconder nada: lo único que decide es cuándo te bajas.
//
// El 3% restante se lo lleva la casa por la vía honesta: 3 de cada 100 vuelos se caen antes
// de llegar a 1,01 y no pagan nada. Es el equivalente al cero de la ruleta.

export const RETORNO = 0.97;

/** Multiplicador mínimo al que se puede saltar. Un vuelo que se cae en 1,00 no paga. */
export const MINIMO = 1.01;

/** Tope, por si sale un sorteo absurdamente afortunado. */
export const TOPE = 1000;

/**
 * Cuánto tarda el multiplicador en duplicarse. Con 7 segundos el avión llega a 2x a los
 * ~4,9 s y a 10x a los ~16 s: da tiempo a decidir sin que la ronda se haga eterna.
 */
export const TAU = 7000;

/** El multiplicador a los `ms` de haber despegado. Crece igual siempre, sin azar. */
export const multiplicadorEn = (ms) =>
  Math.max(1, Math.floor(Math.exp(Math.max(0, ms) / TAU) * 100) / 100);

/** Cuándo llega el avión a ese multiplicador, en milisegundos desde el despegue. */
export const cuandoLlega = (m) => Math.ceil(TAU * Math.log(Math.max(1, m)));

/**
 * Sortea dónde se cae el avión.
 *
 * `RETORNO / u` con u uniforme da exactamente P(llegar a x) = RETORNO/x. Cuando u sale mayor
 * que RETORNO el resultado es menor que 1: eso es el vuelo que se cae de inmediato, y ocurre
 * el 3% de las veces. No es un caso especial ni un castigo — es de dónde sale la ventaja.
 */
export function sortearChoque() {
  const b = new Uint32Array(1);
  let v;
  do {
    crypto.getRandomValues(b);
    v = b[0];
  } while (v === 0);

  const u = v / 0x100000000;
  return Math.min(TOPE, Math.max(1, Math.floor((RETORNO / u) * 100) / 100));
}

/** ¿La ronda ya se resolvió sola, sin que nadie tocara nada? */
export function yaTermino(ronda, ahora) {
  const actual = multiplicadorEn(ahora - ronda.inicio);
  if (actual > ronda.choque) return true;
  return Boolean(ronda.auto) && actual >= ronda.auto;
}

/**
 * Cómo queda la ronda si se cierra en `ahora`.
 *
 * El multiplicador se calcula con el reloj **del servidor**. Si viniera del navegador,
 * bastaría con atrasar el reloj para retirarse siempre justo antes del choque.
 */
export function cerrarEn(ronda, ahora) {
  const actual = multiplicadorEn(ahora - ronda.inicio);
  const efectivo = ronda.auto ? Math.min(actual, ronda.auto) : actual;
  const gano = efectivo >= MINIMO && efectivo <= ronda.choque;

  return {
    choque: ronda.choque,
    multiplicador: gano ? efectivo : ronda.choque,
    automatico: gano && Boolean(ronda.auto) && actual >= ronda.auto,
    gano,
    premio: gano ? Math.round(ronda.apuesta * efectivo) : 0,
  };
}

/** Valida el retiro automático que manda el navegador. */
export function limpiarAuto(valor) {
  if (valor === null || valor === undefined || valor === '') return null;
  const n = Math.floor(Number(valor) * 100) / 100;
  if (!Number.isFinite(n) || n < MINIMO) return { error: `El retiro automático va desde ${MINIMO}.` };
  if (n > TOPE) return { error: `El máximo es ${TOPE}.` };
  return { auto: n };
}
