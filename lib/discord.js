// Avisos a Discord por webhook.
//
// Es el canal menos invasivo que hay a mano: no pide instalar nada, no pide permisos en el
// teléfono de nadie y no hace falta que la persona tenga la web abierta. El mensaje llega
// al canal del taller, mencionando a quien corresponda si tiene su ID de Discord puesto.
//
// Nunca revienta hacia arriba: si Discord está caído o el webhook quedó mal, el turno igual
// se cierra y el aviso interno igual se crea. Un aviso que falla no puede tumbar el registro.

import { obtener } from './config.js';

/** `<@id>` es la mención real; sin ID cae al nombre de usuario, en negrita. */
const aQuien = (usuario, discordId) =>
  discordId ? `<@${discordId}>` : `**${usuario}**`;

export async function avisarDiscord(texto) {
  try {
    const { discordWebhook } = await obtener();
    if (!discordWebhook) return { enviado: false, motivo: 'sin webhook configurado' };

    const r = await fetch(discordWebhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'Sunset Motors',
        content: texto,
        // Sin esto, un mensaje con @everyone escrito por accidente notificaría a todos.
        allowed_mentions: { parse: ['users'] },
      }),
    });

    if (!r.ok) return { enviado: false, motivo: `Discord respondió ${r.status}` };
    return { enviado: true };
  } catch (e) {
    return { enviado: false, motivo: e.message };
  }
}

/** El mensaje de turno cerrado por tiempo. */
export function textoTurnoCerrado({ usuario, discordId, hora, horas }) {
  return (
    `⏱️ ${aQuien(usuario, discordId)} tu turno se cerró solo a las ${hora}, ` +
    `al cumplir ${horas} horas abiertas. ` +
    'Si sigues en el taller, marca entrada de nuevo para que te cuenten las horas.'
  );
}
