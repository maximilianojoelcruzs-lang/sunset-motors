// El top de wager del casino: cuánto ha apostado cada uno en el ciclo abierto.
//
//   sunset:wager   { desde, totales: { usuario: fichas }, jugadas: { usuario: n } }
//   sunset:wager-ciclos  [{ id, desde, hasta, cerradoPor, puestos: [{ usuario, wager, premio }] }]
//
// **Un ciclo nuevo empieza siempre en cero.** Hubo un botón para arrancar el contador con el
// registro de jugadas; se quitó a pedido del usuario, y con razón: metía el histórico entero en
// el primer ciclo y dejaba marcadores de 49 millones que nadie había apostado en ese ciclo. Lo
// que cuenta es lo apostado **desde que el ciclo se abrió**, y punto.
//
// **Se acumula, no se deduce del registro de jugadas.** `sunset:jugadas` guarda solo las 500
// últimas (`MAX_JUGADAS`), así que un ranking calculado sobre él empezaría a perder historial en
// silencio en cuanto el casino se usara de verdad — y nadie lo notaría hasta que alguien
// reclamara su puesto. Sumando en cada apuesta, el total es completo por definición.

import { leer, modificar } from './almacen.js';
import { PREMIOS } from './wager-limites.js';

// `lib/fichas.js` importa `sumar` de este archivo, así que importarlo arriba sería un ciclo.
// Dentro de la función se resuelve al llamarla, cuando los dos módulos ya están cargados.
const deFichas = () => import('./fichas.js');

export const WAGER = 'sunset:wager';
export const CICLOS = 'sunset:wager-ciclos';

const MAX_CICLOS = 24;

const vacio = () => ({ desde: new Date().toISOString(), totales: {}, jugadas: {} });

const comoObjeto = (crudo) =>
  crudo && !Array.isArray(crudo) && typeof crudo === 'object' && crudo.totales ? crudo : vacio();

/**
 * Suma una apuesta al wager de alguien.
 *
 * Va por `modificar` como todo lo que escribe: en el casino varias mesas resuelven a la vez y con
 * una lectura y una escritura sueltas se pierden apuestas — el mismo fallo que se llevaba los
 * marcajes de turno.
 *
 * No se cuentan los ajustes del administrador: una recarga no es una apuesta. Llegan con
 * `apuesta: 0`, así que basta con ignorar lo que no sea positivo.
 */
export async function sumar(usuario, apuesta) {
  const n = Math.round(Number(apuesta));
  if (!usuario || !Number.isFinite(n) || n <= 0) return;

  await modificar(
    WAGER,
    (crudo) => {
      const estado = comoObjeto(crudo);
      return {
        lista: {
          ...estado,
          totales: { ...estado.totales, [usuario]: (estado.totales[usuario] ?? 0) + n },
          jugadas: { ...estado.jugadas, [usuario]: (estado.jugadas[usuario] ?? 0) + 1 },
        },
        hecho: n,
      };
    },
    () => true,
    { porDefecto: vacio() }
  );
}

/** El ciclo abierto, ordenado de más a menos wager, con el premio que le tocaría a cada puesto. */
/**
 * Abre un ciclo nuevo **desde cero**, sin pagar nada.
 *
 * Es distinto de `cerrarCiclo()`: cerrar premia al podio y guarda el resultado; esto solo pone
 * el marcador a cero y arranca a contar desde ahora. Sirve para empezar limpio —una temporada
 * nueva, una prueba que quedó en el contador— sin repartir fichas que nadie ganó.
 *
 * Devuelve cuánto se descartó, porque borrar el marcador de un ciclo en marcha no es poca cosa
 * y la pantalla tiene que poder decirlo.
 */
export async function iniciarCiclo() {
  const previo = comoObjeto(await leer(WAGER, vacio()));
  const descartado = Object.values(previo.totales ?? {}).reduce((s, n) => s + n, 0);

  const { ok } = await modificar(WAGER, () => ({ lista: vacio(), hecho: true }), () => true, {
    porDefecto: vacio(),
  });
  if (!ok) return { error: 'No se pudo abrir el ciclo. Vuelve a intentarlo.' };

  return { descartado, participantes: Object.keys(previo.totales ?? {}).length };
}

export async function ranking() {
  const estado = comoObjeto(await leer(WAGER, vacio()));

  const puestos = Object.entries(estado.totales)
    .map(([usuario, wager]) => ({ usuario, wager, jugadas: estado.jugadas?.[usuario] ?? 0 }))
    // A igual wager, primero quien lo hizo en menos jugadas: apostó más fuerte.
    .sort((a, b) => b.wager - a.wager || a.jugadas - b.jugadas)
    .map((x, i) => ({ ...x, puesto: i + 1, premio: PREMIOS[i] ?? 0 }));

  return { desde: estado.desde, puestos, total: puestos.reduce((n, p) => n + p.wager, 0) };
}

export async function ciclos() {
  return leer(CICLOS, []);
}

/**
 * Cierra el ciclo: guarda el podio, paga los premios y pone los contadores a cero.
 *
 * **El ciclo se guarda antes de pagar.** Si se pagara primero y algo fallara al guardar, el
 * siguiente cierre volvería a pagar a los mismos — es exactamente el fallo del bingo, que pagó
 * dos veces por resolver al leer desde dos pestañas. Con el ciclo escrito primero, un reintento
 * encuentra el ciclo ya cerrado y no paga nada.
 */
export async function cerrarCiclo(porQuien) {
  const { desde, puestos } = await ranking();
  if (!puestos.length) return { error: 'Todavía no hay ninguna apuesta en este ciclo.' };

  const podio = puestos.filter((p) => p.premio > 0);
  const ciclo = {
    id: crypto.randomUUID(),
    desde,
    hasta: new Date().toISOString(),
    cerradoPor: porQuien,
    puestos: podio.map(({ usuario, wager, premio, puesto }) => ({ usuario, wager, premio, puesto })),
    participantes: puestos.length,
    pagado: false,
  };

  const guardado = await modificar(
    CICLOS,
    (lista) => ({ lista: [ciclo, ...lista].slice(0, MAX_CICLOS), hecho: ciclo }),
    () => true
  );
  if (!guardado.ok) return { error: 'No se pudo guardar el cierre. Vuelve a intentarlo.' };

  // Los contadores a cero y el ciclo nuevo empieza ahora.
  await modificar(WAGER, () => ({ lista: vacio(), hecho: true }), () => true, {
    porDefecto: vacio(),
  });

  // Y ahora sí, los premios. Si esto falla, el ciclo ya está cerrado y se puede pagar a mano
  // desde el panel de fichas: mejor un premio pendiente que uno pagado dos veces.
  const { ajustarSaldo } = await deFichas();
  const pagos = [];
  for (const p of ciclo.puestos) {
    const r = await ajustarSaldo(p.usuario, p.premio, `Top de wager (${p.puesto}º) · ${porQuien}`);
    pagos.push({ usuario: p.usuario, premio: p.premio, ok: !r.error, error: r.error });
  }

  if (pagos.every((x) => x.ok)) {
    await modificar(
      CICLOS,
      (lista) => ({
        lista: lista.map((c) => (c.id === ciclo.id ? { ...c, pagado: true } : c)),
        hecho: true,
      }),
      () => true
    );
  }

  return { ciclo, pagos };
}
