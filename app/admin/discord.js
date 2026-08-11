'use client';

import { useState } from 'react';
import { HORAS_MAXIMAS } from '../../lib/turnos-limites';

/**
 * Configura el webhook al que se mandan los avisos de turno cerrado.
 *
 * La URL nunca vuelve del servidor: el panel solo sabe si hay una puesta. Quien tenga esa
 * URL puede publicar en el canal, así que no tiene por qué andar viajando al navegador
 * cada vez que alguien abre el panel.
 */
export default function Discord({ inicial }) {
  const [hayWebhook, setHayWebhook] = useState(inicial.hayWebhook);
  const [url, setUrl] = useState('');
  const [abierto, setAbierto] = useState(false);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const pedir = async (opciones, exito) => {
    setOcupado(true);
    setError('');
    setAviso('');
    try {
      const r = await fetch('/api/config', opciones);
      const cuerpo = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(cuerpo.error || 'No se pudo completar.');
        return false;
      }
      if (cuerpo.config) setHayWebhook(cuerpo.config.hayWebhook);
      setAviso(exito);
      return true;
    } catch {
      setError('Sin conexión con el servidor.');
      return false;
    } finally {
      setOcupado(false);
    }
  };

  const guardar = async (e) => {
    e.preventDefault();
    const ok = await pedir(
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ discordWebhook: url }),
      },
      url.trim() ? 'Webhook guardado.' : 'Webhook quitado: no se avisará por Discord.'
    );
    if (ok) setUrl('');
  };

  return (
    <section className="mecanicos">
      <button
        type="button"
        className="mecanicos-cabeza"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
      >
        <span className={`flecha ${abierto ? 'abierta' : ''}`} />
        <span className="ref-titulo">Avisos por Discord</span>
        <span className={`mecanicos-cuenta ${hayWebhook ? '' : 'apagado'}`}>
          {hayWebhook ? 'activo' : 'sin configurar'}
        </span>
      </button>

      {abierto && (
        <div className="mecanicos-cuerpo">
          {error && <p className="panel-error">{error}</p>}
          {aviso && <p className="mecanicos-aviso">{aviso}</p>}

          <p className="forma-pie" style={{ marginTop: 0 }}>
            Cuando un turno se cierra solo al cumplir {HORAS_MAXIMAS} horas, se avisa en la
            campanita y —si pones un webhook— también en un canal de Discord. Para crearlo:
            en tu servidor, <b>Editar canal → Integraciones → Crear webhook</b>, y copia la
            URL. Para que mencione a cada persona, pon su ID de Discord en la lista de
            mecánicos.
          </p>

          <form className="soli-forma" onSubmit={guardar}>
            <label className="campo">
              <span>URL del webhook</span>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={
                  hayWebhook
                    ? 'Hay uno guardado. Escribe otro para reemplazarlo.'
                    : 'https://discord.com/api/webhooks/…'
                }
              />
            </label>
            <div className="soli-botones">
              <button type="submit" className="accion" disabled={ocupado}>
                {ocupado ? 'Guardando…' : 'Guardar'}
              </button>
              {hayWebhook && (
                <>
                  <button
                    type="button"
                    className="accion destacada"
                    disabled={ocupado}
                    onClick={() => pedir({ method: 'POST' }, 'Mensaje de prueba enviado.')}
                  >
                    Enviar prueba
                  </button>
                  <button
                    type="button"
                    className="accion peligro"
                    disabled={ocupado}
                    onClick={() => {
                      if (!window.confirm('¿Quitar el webhook? Se dejará de avisar por Discord.')) {
                        return;
                      }
                      setUrl('');
                      pedir(
                        {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ discordWebhook: '' }),
                        },
                        'Webhook quitado.'
                      );
                    }}
                  >
                    Quitar
                  </button>
                </>
              )}
            </div>
          </form>

          <p className="mecanicos-pie">
            La URL no se muestra una vez guardada: quien la tenga puede publicar en ese canal.
            Si la pierdes, crea otra en Discord y pégala acá.
          </p>
        </div>
      )}
    </section>
  );
}
