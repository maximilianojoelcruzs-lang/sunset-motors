// Un turno es una fila del registro: quién entró, cuándo, y cuándo salió.
// Mientras `salida` sea null el turno está abierto — esa persona está en el taller.
//
//   { id, usuario, entrada: ISO, salida: ISO|null, corregido?: 'quien', nota?: 'texto' }
//
// Las horas se guardan siempre en ISO (UTC). El formato para leerlas es cosa de la vista.

import { leer, guardar, TURNOS } from './almacen.js';
import { crearAvisos } from './avisos.js';
import { discordDe } from './usuarios.js';
import { avisarDiscord, textoTurnoCerrado } from './discord.js';
import { soloHora } from './tiempo.js';
import { HORAS_MAXIMAS } from './turnos-limites.js';

export const MAX_NOTA = 120;

/**
 * Tope de un turno abierto. No tenemos forma de saber si la persona sigue realmente en el
 * taller —no hay conexión con el juego—, así que un turno que lleva más de esto abierto no
 * prueba nada. Se cierra en el minuto exacto en que se cumplió el tope.
 *
 * La constante vive en turnos-limites.js porque también la necesita el navegador.
 */
export { HORAS_MAXIMAS };
const TOPE_MS = HORAS_MAXIMAS * 3600 * 1000;

/** Cuándo le toca cerrarse a un turno abierto. */
export const venceEn = (turno) => Date.parse(turno.entrada) + TOPE_MS;

const leerTurnos = () => leer(TURNOS);
const guardarTurnos = (lista) => guardar(TURNOS, lista);

/**
 * Cierra los turnos que pasaron del tope y devuelve cuáles cerró.
 *
 * Se ejecuta al leer, no en un proceso de fondo, porque esta app no tiene ninguno. La
 * salida no es «ahora» sino la hora exacta en que se cumplieron las horas, así que el
 * resultado es el mismo mire quien mire y cuando mire: si nadie abre la app en tres días,
 * el turno igual queda cerrado a las tres horas, no a los tres días.
 */
async function cerrarVencidos(lista) {
  const ahora = Date.now();
  const vencidos = lista.filter((t) => !t.salida && venceEn(t) <= ahora);
  if (!vencidos.length) return { lista, cerrados: [] };

  const ids = new Set(vencidos.map((t) => t.id));
  const siguiente = lista.map((t) =>
    ids.has(t.id)
      ? { ...t, salida: new Date(venceEn(t)).toISOString(), cerradoAuto: true }
      : t
  );

  await guardarTurnos(siguiente);

  const cerrados = siguiente.filter((t) => ids.has(t.id));
  await avisarCierres(cerrados);

  return { lista: siguiente, cerrados };
}

/**
 * Avisa de los turnos que se cerraron solos: campanita para todos, y Discord si hay webhook.
 *
 * Nada de esto puede tumbar el cierre: el turno ya quedó guardado antes de llegar acá, y si
 * Discord falla el registro sigue siendo correcto. Por eso todo va envuelto en try.
 */
async function avisarCierres(cerrados) {
  if (!cerrados.length) return;

  try {
    await crearAvisos(
      cerrados.map((t) => ({
        para: t.usuario,
        texto:
          `Tu turno se cerró solo a las ${soloHora(t.salida)}, al cumplir ` +
          `${HORAS_MAXIMAS} horas abiertas. Si sigues trabajando, marca entrada de nuevo.`,
        enlace: '/',
      }))
    );
  } catch {
    // Un aviso perdido no vale romper el registro de horas.
  }

  for (const t of cerrados) {
    try {
      await avisarDiscord(
        textoTurnoCerrado({
          usuario: t.usuario,
          discordId: await discordDe(t.usuario),
          hora: soloHora(t.salida),
          horas: HORAS_MAXIMAS,
        })
      );
    } catch {
      // Idem: Discord es un extra, no una dependencia.
    }
  }
}

/**
 * Lee los turnos ya con los vencidos cerrados. Todo lo que consulte turnos debe pasar por
 * acá: si alguna ruta lee la lista cruda, mostrará turnos abiertos que ya deberían estar
 * cerrados y las horas no cuadrarán entre pantallas.
 */
export async function leerAlDia() {
  return cerrarVencidos(await leerTurnos());
}

const ordenar = (lista) => [...lista].sort((a, b) => b.entrada.localeCompare(a.entrada));

/** Turnos de una persona, o de todas si no se pasa usuario. Más reciente primero. */
export async function listar(usuario) {
  const { lista: todos } = await leerAlDia();
  const filtrados = usuario ? todos.filter((t) => t.usuario === usuario) : todos;
  return ordenar(filtrados);
}

/** El turno abierto de una persona, si tiene uno. */
export async function turnoAbierto(usuario) {
  const { lista } = await leerAlDia();
  return lista.find((t) => t.usuario === usuario && !t.salida) ?? null;
}

/** Marca entrada. Si ya hay un turno abierto lo devuelve tal cual, sin duplicar. */
export async function marcarEntrada(usuario) {
  const { lista: todos } = await leerAlDia();
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
  const { lista: todos } = await leerAlDia();
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
