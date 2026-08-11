'use client';

/**
 * Marca entrada o salida. Vive aparte porque lo usan dos sitios: la barra de marcaje de la
 * calculadora y el menú de perfil, y los dos tienen que hablarle igual al servidor.
 *
 * Devuelve { turno } con el turno resultante (null tras marcar salida), o { error }.
 */
export async function marcarTurno(accion) {
  try {
    const r = await fetch('/api/turnos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion }),
    });
    const cuerpo = await r.json().catch(() => ({}));
    if (!r.ok) return { error: cuerpo.error || 'No se pudo marcar.' };
    return { turno: accion === 'entrada' ? cuerpo.turno : null };
  } catch {
    return { error: 'Sin conexión con el servidor.' };
  }
}
