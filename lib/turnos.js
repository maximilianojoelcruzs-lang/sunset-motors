// Un turno es una fila del registro: quién entró, cuándo, y cuándo salió.
// Mientras `salida` sea null el turno está abierto — esa persona está en el taller.
//
//   { id, usuario, entrada: ISO, salida: ISO|null, corregido?: 'quien', nota?: 'texto' }
//
// Las horas se guardan siempre en ISO (UTC). El formato para leerlas es cosa de la vista.

import { leer, guardar, TURNOS } from './almacen.js';

export const MAX_NOTA = 120;

const leerTurnos = () => leer(TURNOS);
const guardarTurnos = (lista) => guardar(TURNOS, lista);

const ordenar = (lista) => [...lista].sort((a, b) => b.entrada.localeCompare(a.entrada));

/** Turnos de una persona, o de todas si no se pasa usuario. Más reciente primero. */
export async function listar(usuario) {
  const todos = await leerTurnos();
  const filtrados = usuario ? todos.filter((t) => t.usuario === usuario) : todos;
  return ordenar(filtrados);
}

/** El turno abierto de una persona, si tiene uno. */
export async function turnoAbierto(usuario) {
  const todos = await leerTurnos();
  return todos.find((t) => t.usuario === usuario && !t.salida) ?? null;
}

/** Marca entrada. Si ya hay un turno abierto lo devuelve tal cual, sin duplicar. */
export async function marcarEntrada(usuario) {
  const todos = await leerTurnos();
  const abierto = todos.find((t) => t.usuario === usuario && !t.salida);
  if (abierto) return { turno: abierto, yaEstaba: true };

  const turno = {
    id: crypto.randomUUID(),
    usuario,
    entrada: new Date().toISOString(),
    salida: null,
  };
  await guardarTurnos([...todos, turno]);
  return { turno, yaEstaba: false };
}

/** Cierra el turno abierto. Si no hay ninguno devuelve null. */
export async function marcarSalida(usuario) {
  const todos = await leerTurnos();
  const i = todos.findIndex((t) => t.usuario === usuario && !t.salida);
  if (i === -1) return null;

  const cerrado = { ...todos[i], salida: new Date().toISOString() };
  const copia = [...todos];
  copia[i] = cerrado;
  await guardarTurnos(copia);
  return cerrado;
}

/**
 * Corrección de administrador. Solo deja tocar entrada, salida y nota, y exige que la
 * salida no quede antes que la entrada — un turno de duración negativa rompe los totales.
 */
export async function corregir(id, cambios, porQuien) {
  const todos = await leerTurnos();
  const i = todos.findIndex((t) => t.id === id);
  if (i === -1) return { error: 'Ese turno no existe.' };

  const actual = todos[i];
  const entrada = cambios.entrada ?? actual.entrada;
  const salida = 'salida' in cambios ? cambios.salida : actual.salida;

  if (Number.isNaN(Date.parse(entrada))) return { error: 'La hora de entrada no es válida.' };
  if (salida && Number.isNaN(Date.parse(salida))) {
    return { error: 'La hora de salida no es válida.' };
  }
  if (salida && Date.parse(salida) < Date.parse(entrada)) {
    return { error: 'La salida no puede ser anterior a la entrada.' };
  }

  const nota =
    typeof cambios.nota === 'string' ? cambios.nota.trim().slice(0, MAX_NOTA) : actual.nota;

  const copia = [...todos];
  copia[i] = { ...actual, entrada, salida, nota, corregido: porQuien };
  await guardarTurnos(copia);
  return { turno: copia[i] };
}

export async function borrar(id) {
  const todos = await leerTurnos();
  const quedan = todos.filter((t) => t.id !== id);
  if (quedan.length === todos.length) return false;
  await guardarTurnos(quedan);
  return true;
}
