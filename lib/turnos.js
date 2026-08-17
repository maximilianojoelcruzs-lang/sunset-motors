// Un turno es una fila del registro: quién entró, cuándo, y cuándo salió.
// Mientras `salida` sea null el turno está abierto — esa persona está en el taller.
//
//   { id, usuario, entrada: ISO, salida: ISO|null, corregido?: 'quien', nota?: 'texto' }
//
// Las horas se guardan siempre en ISO (UTC). El formato para leerlas es cosa de la vista.

import { leer, guardar, modificar, TURNOS } from './almacen.js';
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
/** El cierre, **sin tocar el almacén**. Así puede ir dentro de un marcaje sin escribir dos veces. */
function cerrarEnMemoria(lista) {
  const ahora = Date.now();
  const ids = new Set(lista.filter((t) => !t.salida && venceEn(t) <= ahora).map((t) => t.id));
  if (!ids.size) return { lista, cerrados: [] };

  const siguiente = lista.map((t) =>
    ids.has(t.id)
      ? { ...t, salida: new Date(venceEn(t)).toISOString(), cerradoAuto: true }
      : t
  );
  return { lista: siguiente, cerrados: siguiente.filter((t) => ids.has(t.id)) };
}

async function cerrarVencidos(lista) {
  const { lista: siguiente, cerrados } = cerrarEnMemoria(lista);
  if (!cerrados.length) return { lista, cerrados: [] };

  // También por `modificar`: si no, cerrar un vencido al abrir una página podía llevarse por
  // delante el marcaje que otra persona estaba haciendo en ese mismo instante.
  const { ok } = await modificar(
    TURNOS,
    (actual) => {
      const paso = cerrarEnMemoria(actual);
      return paso.cerrados.length ? { lista: paso.lista, hecho: paso.cerrados } : null;
    },
    (quedo, hechos) => hechos.every((c) => quedo.find((t) => t.id === c.id)?.salida)
  );

  if (ok) await avisarCierres(cerrados);
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

/**
 * Marca entrada. Si ya hay un turno abierto lo devuelve tal cual, sin duplicar.
 *
 * Va por `modificar` porque al empezar el turno **marcan todos a la vez**, y con la lectura y
 * la escritura sueltas el último en guardar borraba a los demás: seis marcando dejaban uno.
 */
export async function marcarEntrada(usuario) {
  const { ok, hecho } = await modificar(
    TURNOS,
    (lista) => {
      const { lista: alDia, cerrados } = cerrarEnMemoria(lista);
      const abierto = alDia.find((t) => t.usuario === usuario && !t.salida);
      if (abierto) return { lista: alDia, hecho: { turno: abierto, yaEstaba: true, cerrados } };

      const turno = {
        id: crypto.randomUUID(),
        usuario,
        entrada: new Date().toISOString(),
        salida: null,
      };
      return { lista: [...alDia, turno], hecho: { turno, yaEstaba: false, cerrados } };
    },
    (quedo, hecho) => quedo.some((t) => t.id === hecho.turno.id && !t.salida)
  );

  if (!ok) return { error: 'No se pudo marcar la entrada. Vuelve a intentarlo.' };
  await avisarCierres(hecho.cerrados);
  return { turno: hecho.turno, yaEstaba: hecho.yaEstaba };
}

/** Cierra el turno abierto. Si no hay ninguno devuelve null. */
export async function marcarSalida(usuario) {
  const { ok, hecho } = await modificar(
    TURNOS,
    (lista) => {
      const { lista: alDia, cerrados } = cerrarEnMemoria(lista);
      const i = alDia.findIndex((t) => t.usuario === usuario && !t.salida);
      if (i === -1) return { lista: alDia, hecho: { turno: null, cerrados } };

      const copia = [...alDia];
      copia[i] = { ...copia[i], salida: new Date().toISOString() };
      return { lista: copia, hecho: { turno: copia[i], cerrados } };
    },
    (quedo, hecho) => !hecho.turno || Boolean(quedo.find((t) => t.id === hecho.turno.id)?.salida)
  );

  if (!ok) return { error: 'No se pudo marcar la salida. Vuelve a intentarlo.' };
  await avisarCierres(hecho.cerrados);
  return hecho.turno;
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
