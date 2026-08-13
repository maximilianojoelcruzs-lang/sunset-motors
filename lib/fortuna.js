// Ruleta de la suerte: una rueda de 40 gajos, se gira y se cobra lo que marque el gajo.
//
// No se apuesta a un sitio como en la ruleta europea — acá se gira y ya. Todo el juego está
// en cómo se reparten los gajos:
//
//   18 gajos  x0      45,0%   se pierde
//   10 gajos  x0,8    25,0%   casi recuperas
//    8 gajos  x1,5    20,0%
//    3 gajos  x3       7,5%
//    1 gajo   x10      2,5%   el premio de la rueda
//
//   retorno = (18×0 + 10×0,8 + 8×1,5 + 3×3 + 1×10) / 40 = 39/40 = 97,50%
//
// La ventaja de la casa son esos 18 gajos vacíos, y no un pago recortado: cada gajo paga
// exactamente lo que dice. `retornoTeorico()` lo calcula desde la propia rueda, así que si
// alguien cambia un gajo la pantalla muestra el número nuevo sola.
//
// Una rueda de feria de verdad (la Big Six de los casinos) se queda entre el 11% y el 24%.
// Esta se queda con el 2,5%: son las mismas reglas, con los gajos repartidos de otra forma.

/** La rueda, gajo a gajo. El orden es el que se dibuja, alternando premios y vacíos. */
export const GAJOS = (() => {
  const receta = [
    { multiplicador: 10, cuantos: 1, color: '#ffcf5c' },
    { multiplicador: 3, cuantos: 3, color: '#ff6ec7' },
    { multiplicador: 1.5, cuantos: 8, color: '#22e6d0' },
    { multiplicador: 0.8, cuantos: 10, color: '#7cc4ff' },
    { multiplicador: 0, cuantos: 18, color: '#2a3050' },
  ];

  // Los premios se reparten por la rueda, no se apilan: todos los buenos juntos se ve como
  // una rueda trucada aunque las probabilidades sean exactamente las mismas. Se van tomando
  // por turnos de cada montón —x10, x3, x1,5, x0,8, x10…— y entre medio va un gajo vacío.
  //
  // El reparto es fijo, sin azar: la rueda tiene que dibujarse igual en el servidor y en el
  // navegador o React descarta el árbol por desajuste de hidratación.
  const montones = receta
    .filter((r) => r.multiplicador > 0)
    .map((r) => Array.from({ length: r.cuantos }, () => ({ ...r, cuantos: undefined })));

  const premios = [];
  while (montones.some((m) => m.length)) {
    for (const monton of montones) {
      const gajo = monton.shift();
      if (gajo) premios.push({ multiplicador: gajo.multiplicador, color: gajo.color });
    }
  }

  const vacio = receta.find((r) => r.multiplicador === 0);
  const vacios = Array.from({ length: vacio.cuantos }, () => ({
    multiplicador: 0,
    color: vacio.color,
  }));

  // Un vacío cada tantos premios, repartidos parejo con el mismo truco de la "deuda".
  const rueda = [];
  const cada = vacios.length / premios.length;
  let deuda = 0;
  for (const premio of premios) {
    rueda.push(premio);
    deuda += cada;
    while (deuda >= 1 && vacios.length) {
      rueda.push(vacios.pop());
      deuda -= 1;
    }
  }
  while (vacios.length) rueda.push(vacios.pop());

  return rueda;
})();

export const CASILLAS = GAJOS.length;

/** Cuántos gajos hay de cada multiplicador, de mayor a menor. Es la tabla de la pantalla. */
export const TABLA = [...new Set(GAJOS.map((g) => g.multiplicador))]
  .sort((a, b) => b - a)
  .map((multiplicador) => ({
    multiplicador,
    cuantos: GAJOS.filter((g) => g.multiplicador === multiplicador).length,
    color: GAJOS.find((g) => g.multiplicador === multiplicador).color,
  }));

export const probabilidadDe = (multiplicador) =>
  GAJOS.filter((g) => g.multiplicador === multiplicador).length / CASILLAS;

/** Retorno al jugador, calculado desde la propia rueda. */
export const retornoTeorico = () =>
  GAJOS.reduce((s, g) => s + g.multiplicador, 0) / CASILLAS;

/**
 * Gira. Sin sesgo: se descartan los valores del último tramo incompleto en vez de repartir
 * el resto, que es lo que haría salir un pelo más seguido a los primeros gajos.
 */
export function girar(apuesta) {
  const tope = Math.floor(0x100000000 / CASILLAS) * CASILLAS;
  const b = new Uint32Array(1);
  let v;
  do {
    crypto.getRandomValues(b);
    v = b[0];
  } while (v >= tope);

  const gajo = v % CASILLAS;
  const multiplicador = GAJOS[gajo].multiplicador;

  return {
    gajo,
    multiplicador,
    premio: Math.round(apuesta * multiplicador),
  };
}
