// Ajustes del taller que el encargado puede cambiar sin desplegar.
//
//   { discordWebhook, actualizado, actualizadoPor }
//
// El webhook de Discord es sensible: quien lo tenga puede publicar en ese canal. Por eso
// nunca se devuelve entero al navegador — el panel solo recibe si está puesto o no.

import { leer, guardar } from './almacen.js';

export const CONFIG = 'sunset:config';

const VACIA = { discordWebhook: null, actualizado: null, actualizadoPor: null };

export async function obtener() {
  return (await leer(CONFIG, null)) ?? VACIA;
}

/** Lo que sí puede viajar al navegador. */
export async function publica() {
  const c = await obtener();
  return {
    hayWebhook: Boolean(c.discordWebhook),
    actualizado: c.actualizado,
    actualizadoPor: c.actualizadoPor,
  };
}

export async function guardarWebhook(url, usuario) {
  const limpio = typeof url === 'string' ? url.trim() : '';

  // Cadena vacía = quitarlo, que es la forma de apagar los avisos a Discord.
  //
  // En producción se exige el dominio de Discord, para que un error de copiado no termine
  // mandando los avisos del taller a un servidor cualquiera. En desarrollo basta con que
  // tenga forma de webhook, así se puede probar contra un servidor local.
  const patron =
    process.env.NODE_ENV === 'production'
      ? /^https:\/\/(discord\.com|discordapp\.com)\/api\/webhooks\//
      : /\/api\/webhooks\//;

  if (limpio && !patron.test(limpio)) {
    return { error: 'Eso no parece un webhook de Discord.' };
  }

  const config = {
    discordWebhook: limpio || null,
    actualizado: new Date().toISOString(),
    actualizadoPor: usuario,
  };
  await guardar(CONFIG, config);
  return { config };
}
