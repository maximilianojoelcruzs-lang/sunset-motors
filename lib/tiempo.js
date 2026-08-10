// Formato de horas. Todo se guarda en ISO/UTC y se muestra en hora de Chile, fija:
// si alguien abre la app desde otra zona horaria, el registro tiene que leerse igual
// para todos o los turnos parecen movidos.

const ZONA = 'America/Santiago';

const hora = new Intl.DateTimeFormat('es-CL', {
  timeZone: ZONA,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const fecha = new Intl.DateTimeFormat('es-CL', {
  timeZone: ZONA,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const diaSemana = new Intl.DateTimeFormat('es-CL', { timeZone: ZONA, weekday: 'short' });

export const soloHora = (iso) => (iso ? hora.format(new Date(iso)) : '—');
export const soloFecha = (iso) => (iso ? fecha.format(new Date(iso)) : '—');
export const diaCorto = (iso) => (iso ? diaSemana.format(new Date(iso)) : '');

/** Milisegundos trabajados. Un turno abierto se mide contra `ahora`. */
export const duracionMs = (turno, ahora = Date.now()) => {
  const desde = Date.parse(turno.entrada);
  const hasta = turno.salida ? Date.parse(turno.salida) : ahora;
  return Math.max(0, hasta - desde);
};

/** 2h 05m. Para totales largos no corta las horas: 143h 20m es válido. */
export const enHoras = (ms) => {
  const minutos = Math.floor(ms / 60000);
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${h}h ${String(m).padStart(2, '0')}m`;
};

/** 'AAAA-MM-DD' en hora de Chile — sirve para agrupar y para los <input type="date">. */
export const diaISO = (iso) => {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
  return partes;
};

/** ISO -> valor para <input type="datetime-local">, en hora de Chile. */
export const paraInput = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const v = (t) => p.find((x) => x.type === t).value;
  return `${v('year')}-${v('month')}-${v('day')}T${v('hour')}:${v('minute')}`;
};

/**
 * Valor de <input type="datetime-local"> -> ISO, interpretándolo en hora de Chile.
 * Sin esto el navegador lo tomaría como hora local del que edita, y un admin en otra
 * zona horaria correría todos los turnos que tocara.
 */
export const desdeInput = (valor) => {
  if (!valor) return null;
  // Se prueba el desfase con una fecha tentativa y se corrige: Chile cambia de horario.
  const tentativa = new Date(`${valor}:00Z`);
  const enZona = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(tentativa);
  const g = (t) => enZona.find((x) => x.type === t).value;
  const comoUTC = Date.parse(`${g('year')}-${g('month')}-${g('day')}T${g('hour')}:${g('minute')}:${g('second')}Z`);
  const desfase = comoUTC - tentativa.getTime();
  return new Date(tentativa.getTime() - desfase).toISOString();
};
