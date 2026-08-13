// Solicitudes de retiro del casino.
//
//   sunset:retiros  [{ id, usuario, fichas, estado, pedido, resuelto, resueltoPor, nota }]
//
// La persona pide retirar N fichas; **se le descuentan en el momento** y el administrador
// recibe el aviso para entregarle el dinero dentro del juego. Cuando lo entrega, marca la
// solicitud como entregada.
//
// Se descuenta al pedir y no al entregar a propósito: si el saldo siguiera ahí, se podría
// pedir el retiro y seguir jugando esas mismas fichas, y el administrador terminaría pagando
// algo que ya no existe. Rechazar una solicitud **devuelve las fichas** — es lo mismo que no
// haberla pedido.
//
//   pendiente → entregado
//             → rechazado (y vuelven las fichas)

import { leer, guardar } from './almacen.js';
import { cobrar, moverSaldo, saldoDe, anotar } from './fichas.js';
import { RETIRO_MINIMO } from './retiros-limites.js';

export const RETIROS = 'sunset:retiros';

export { RETIRO_MINIMO };
export const MAX_NOTA = 200;

export const ESTADOS = {
  pendiente: 'Pendiente',
  entregado: 'Entregado',
  rechazado: 'Rechazado',
};

export async function listar() {
  const todas = await leer(RETIROS);
  return [...todas].sort((a, b) => b.pedido.localeCompare(a.pedido));
}

export const listarDe = async (usuario) =>
  (await listar()).filter((r) => r.usuario === usuario);

export const pendientes = async () => (await listar()).filter((r) => r.estado === 'pendiente');

export async function porId(id) {
  return (await leer(RETIROS)).find((r) => r.id === id) ?? null;
}

/**
 * Pide un retiro. Descuenta las fichas y deja la solicitud pendiente.
 *
 * Una sola solicitud abierta por persona: con varias a la vez, el administrador no sabe
 * cuáles ya pagó y la gente termina pidiendo dos veces lo mismo.
 */
export async function pedir(usuario, fichas, nota) {
  const n = Math.round(Number(fichas));
  if (!Number.isFinite(n) || n < RETIRO_MINIMO) {
    return { error: `El retiro mínimo es de ${RETIRO_MINIMO} fichas.` };
  }

  const lista = await leer(RETIROS);
  if (lista.some((r) => r.usuario === usuario && r.estado === 'pendiente')) {
    return { error: 'Ya tienes una solicitud esperando. Espera a que te la resuelvan.' };
  }

  if (n > (await saldoDe(usuario))) return { error: 'No tienes tantas fichas.' };

  const retiro = {
    id: crypto.randomUUID(),
    usuario,
    fichas: n,
    nota: (nota ?? '').trim().slice(0, MAX_NOTA),
    estado: 'pendiente',
    pedido: new Date().toISOString(),
    resuelto: null,
    resueltoPor: null,
  };

  await guardar(RETIROS, [retiro, ...lista]);
  const saldo = await cobrar(usuario, n);
  await anotar({
    usuario,
    juego: 'retiro',
    apuesta: n,
    premio: 0,
    neto: -n,
    detalle: 'Solicitud de retiro',
  });

  return { retiro, saldo };
}

/** El administrador marca que ya entregó el dinero en el juego. */
export async function entregar(id, porQuien) {
  return cerrar(id, 'entregado', porQuien);
}

/** Rechazar devuelve las fichas: es como si no hubiera pedido nada. */
export async function rechazar(id, porQuien, motivo) {
  const lista = await leer(RETIROS);
  const retiro = lista.find((r) => r.id === id);
  if (!retiro) return { error: 'Esa solicitud no existe.' };
  if (retiro.estado !== 'pendiente') return { error: 'Esa solicitud ya estaba resuelta.' };

  const cerrada = await cerrar(id, 'rechazado', porQuien, motivo);
  if (cerrada.error) return cerrada;

  await moverSaldo(retiro.usuario, retiro.fichas);
  await anotar({
    usuario: retiro.usuario,
    juego: 'retiro',
    apuesta: 0,
    premio: retiro.fichas,
    neto: retiro.fichas,
    detalle: `Retiro rechazado por ${porQuien}, fichas devueltas`,
  });

  return cerrada;
}

async function cerrar(id, estado, porQuien, motivo) {
  const lista = await leer(RETIROS);
  const i = lista.findIndex((r) => r.id === id);
  if (i === -1) return { error: 'Esa solicitud no existe.' };
  if (lista[i].estado !== 'pendiente') return { error: 'Esa solicitud ya estaba resuelta.' };

  const copia = [...lista];
  copia[i] = {
    ...copia[i],
    estado,
    resuelto: new Date().toISOString(),
    resueltoPor: porQuien,
    motivo: (motivo ?? '').trim().slice(0, MAX_NOTA) || null,
  };
  await guardar(RETIROS, copia);
  return { retiro: copia[i] };
}
