// Carrera de surf: seis competidores, se apuesta a quién gana la ola.
//
// Es una carrera de caballos de toda la vida, con tabla en vez de caballo. Y como en las
// carreras de verdad, **la ventaja de la casa está en las cuotas, no en el sorteo**:
//
//   cuota = RETORNO / probabilidad
//
// El favorito gana 3 de cada 10 veces y paga 3,17 a 1; con una cuota "justa" pagaría 3,33.
// Esa diferencia, la misma en los seis, es lo que se queda la casa: **5%**. En una casa de
// apuestas se llama sobrerredondeo, y se calcula igual.
//
// El sorteo no está tocado: cada surfista gana exactamente con la probabilidad que dice su
// ficha. Si algún día alguien quiere cambiar la ventaja, se cambia `RETORNO` y las cuotas
// salen solas — nunca los pesos del sorteo.

export const RETORNO = 0.95; // 5% para la casa, repartido igual entre los seis

/**
 * Los seis. `peso` es de cuántas de cada 100 olas gana cada uno, y suma 100 exacto: no hay
 * un séptimo resultado ni empates.
 */
export const SURFISTAS = [
  { id: 'kala', nombre: 'Kala', tabla: 'Shortboard', color: '#22e6d0', peso: 30 },
  { id: 'nico', nombre: 'Nico', tabla: 'Fish', color: '#ffcf5c', peso: 24 },
  { id: 'mia', nombre: 'Mía', tabla: 'Gun', color: '#ff6ec7', peso: 18 },
  { id: 'tavo', nombre: 'Tavo', tabla: 'Longboard', color: '#7cc4ff', peso: 13 },
  { id: 'rex', nombre: 'Rex', tabla: 'Bodyboard', color: '#b14cff', peso: 9 },
  { id: 'lupe', nombre: 'Lupe', tabla: 'Foil', color: '#ff9d2e', peso: 6 },
];

const TOTAL = SURFISTAS.reduce((s, x) => s + x.peso, 0); // 100

export const probabilidadDe = (id) =>
  (SURFISTAS.find((s) => s.id === id)?.peso ?? 0) / TOTAL;

/**
 * La cuota de alguien, «a 1». Sale de la probabilidad y no de una tabla escrita a mano, así
 * que los seis dejan exactamente la misma ventaja y ninguno puede quedar descuadrado.
 */
export const cuotaDe = (id) => Math.round((RETORNO / probabilidadDe(id)) * 100) / 100;

export const surfista = (id) => SURFISTAS.find((s) => s.id === id) ?? null;

/** Entero de 0 a n-1 sin sesgo: se descarta el sobrante en vez de repartirlo. */
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

/** Saca uno de la lista según su peso. */
function sortearDe(candidatos) {
  const total = candidatos.reduce((s, x) => s + x.peso, 0);
  let n = alAzar(total);
  for (const c of candidatos) {
    if (n < c.peso) return c;
    n -= c.peso;
  }
  return candidatos[candidatos.length - 1];
}

/**
 * Corre la ola. Devuelve el orden completo de llegada, no solo el ganador: la animación
 * necesita saber dónde termina cada uno, y sacarlo en el navegador sería inventarlo.
 *
 * El resto de los puestos se sortea con los mismos pesos, sacando al que ya llegó. Es lo
 * que hace que un favorito que no gana suele quedar segundo, como en cualquier carrera.
 */
export function correr() {
  const quedan = SURFISTAS.map((s) => ({ ...s }));
  const orden = [];
  while (quedan.length) {
    const elegido = sortearDe(quedan);
    orden.push(elegido.id);
    quedan.splice(quedan.indexOf(elegido), 1);
  }
  return orden;
}

/**
 * Resuelve una apuesta contra el orden de llegada.
 * @returns { gano, premio, cuota } — el premio incluye la apuesta, como en toda la sala.
 */
export function resolverApuesta({ id, monto, orden }) {
  if (!surfista(id)) return { error: 'Ese surfista no compite.' };

  const gano = orden[0] === id;
  const cuota = cuotaDe(id);

  return {
    id,
    cuota,
    gano,
    puesto: orden.indexOf(id) + 1,
    premio: gano ? Math.round(monto * cuota) : 0,
  };
}
