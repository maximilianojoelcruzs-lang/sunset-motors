'use client';

import { useState } from 'react';
import Barra from '../../barra';
import useSondeo from '../../sondeo';
import { soloFecha, soloHora } from '../../../lib/tiempo';
import { PREMIOS, QUE_ES_WAGER } from '../../../lib/wager-limites';
import Reglas from './reglas';

const fichas = (n) => new Intl.NumberFormat('es-CL').format(n ?? 0);
const cuando = (iso) => (iso ? `${soloFecha(iso)} ${soloHora(iso)}` : '—');
const MEDALLAS = ['🥇', '🥈', '🥉'];

export default function TopWager({ usuario, admin, accesos, inicial, ciclosIniciales, fallo }) {
  const [datos, setDatos] = useState(inicial);
  const [historial, setHistorial] = useState(ciclosIniciales);
  const [error, setError] = useState(fallo);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState('');
  // Las reglas arrancan cerradas: quien ya sabe cómo va viene a ver la tabla, no a leer.
  const [verReglas, setVerReglas] = useState(false);

  const recargar = async () => {
    const r = await fetch('/api/casino/wager', { cache: 'no-store' });
    const cuerpo = await r.json().catch(() => ({}));
    if (!r.ok) return;
    setDatos(cuerpo);
    setHistorial(cuerpo.ciclos ?? []);
  };

  // La tabla se mueve con cada apuesta de cualquiera: se pone al día sola.
  useSondeo(recargar, 20000);

  const pedir = async (accion, confirmacion) => {
    if (confirmacion && !window.confirm(confirmacion)) return;
    setOcupado(true);
    setError('');
    setAviso('');
    try {
      const r = await fetch('/api/casino/wager', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion }),
      });
      const cuerpo = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(cuerpo.error || 'No se pudo completar.');
        return;
      }

      setDatos(cuerpo);
      if (cuerpo.ciclos) setHistorial(cuerpo.ciclos);

      // Si algún premio no se pudo pagar hay que decirlo con nombre y apellido: el ciclo ya
      // está cerrado y ese premio hay que pagarlo a mano, no se reintenta solo.
      if (cuerpo.descartado !== undefined) {
        setAviso(
          cuerpo.descartado > 0
            ? `Ciclo nuevo. Se descartaron ${new Intl.NumberFormat('es-CL').format(cuerpo.descartado)} ` +
                `de wager de ${cuerpo.participantes} persona${cuerpo.participantes === 1 ? '' : 's'}, sin pagar premios.`
            : 'Ciclo nuevo: se cuenta desde ahora.'
        );
      }

      if (cuerpo.pagos) {
        const fallidos = cuerpo.pagos.filter((p) => !p.ok);
        setAviso(
          fallidos.length
            ? `Ciclo cerrado, pero ${fallidos.length} premios no se pudieron generar: ` +
                `${fallidos.map((p) => p.usuario).join(', ')}. Créales la devolución a mano.`
            : `Ciclo cerrado. Se crearon ${cuerpo.pagos.length} solicitudes de devolución, ` +
              'pendientes de que les pagues en el juego.'
        );
      }
    } catch {
      setError('Sin conexión con el servidor.');
    } finally {
      setOcupado(false);
    }
  };

  const yo = datos.puestos.find((p) => p.usuario === usuario);
  const ultimoPremiado = datos.puestos[PREMIOS.length - 1];

  return (
    <div className="casino">
      <Barra usuario={usuario} admin={admin} accesos={accesos} variante="casino" seccion="top" />

      <main className="envoltura">
        <header className="titulo">
          <div>
            <h1 className="titulo-texto">Top de wager</h1>
            <p className="titulo-bajada">
              Ciclo abierto desde el {cuando(datos.desde)} · {fichas(datos.total)} fichas apostadas
            </p>
          </div>

          <span className="fila-acciones">
            {/* Las reglas son de cualquiera que juegue, no del encargado: van antes que los
                mandos de admin y sin condición. */}
            <button
              type="button"
              className="accion"
              onClick={() => setVerReglas((v) => !v)}
              aria-expanded={verReglas}
              aria-controls="reglas-wager"
            >
              {verReglas ? 'Ocultar reglas' : 'Cómo funciona'}
            </button>

            {admin && (
              <>
                {/* Empezar de cero sin pagar a nadie. Va antes de «Cerrar», que es el que
                    mueve fichas. */}
                <button
                  type="button"
                  className="accion"
                  disabled={ocupado}
                  onClick={() =>
                    pedir(
                      'iniciar',
                      datos.puestos.length
                        ? '¿Empezar un ciclo nuevo? El marcador vuelve a cero y NADIE cobra premios. ' +
                            'Si querías premiar al podio, usa «Cerrar ciclo y pagar».'
                        : '¿Empezar a contar desde ahora?'
                    )
                  }
                >
                  Iniciar ciclo
                </button>

                <button
                  type="button"
                  className="accion peligro"
                  disabled={ocupado || !datos.puestos.length}
                  onClick={() =>
                    pedir(
                      'cerrar',
                      '¿Cerrar el ciclo? Al podio se le crea una solicitud de devolución con su premio ' +
                        '—se la pagas en el juego— y los contadores vuelven a cero.'
                    )
                  }
                >
                  Cerrar ciclo y pagar
                </button>
              </>
            )}
          </span>
        </header>

        {error && <p className="panel-error">{error}</p>}
        {aviso && <p className="top-aviso">{aviso}</p>}

        <section className="top-premios">
          {PREMIOS.map((premio, i) => (
            <div className="top-premio" key={i}>
              <span className="top-medalla" aria-hidden="true">
                {MEDALLAS[i]}
              </span>
              <strong>${fichas(premio)}</strong>
              <em>en el juego · {i + 1}º puesto</em>
            </div>
          ))}
        </section>

        <p className="top-explica">
          <strong>Wager</strong>: {QUE_ES_WAGER}{' '}
          {!verReglas && (
            <button type="button" className="top-enlace" onClick={() => setVerReglas(true)}>
              Ver las reglas completas
            </button>
          )}
        </p>

        {/* Va sobre la tabla y no en un diálogo: se leen las reglas mirando el ranking del que
            hablan, y en una ventana de 440 px el ejemplo de dos personas no cabe. */}
        {verReglas && (
          <div id="reglas-wager">
            <Reglas />
          </div>
        )}

        {datos.puestos.length === 0 ? (
          <p className="vacio">
            Todavía no hay apuestas en este ciclo. En cuanto alguien juegue, aparece acá.
          </p>
        ) : (
          <ol className="top-lista">
            {datos.puestos.map((p) => (
              <li
                key={p.usuario}
                className={`${p.premio ? 'premiado' : ''} ${p.usuario === usuario ? 'tu' : ''}`}
              >
                <span className="top-puesto">{MEDALLAS[p.puesto - 1] ?? `${p.puesto}º`}</span>
                <span className="top-usuario">
                  {p.usuario}
                  {p.usuario === usuario && <em> · tú</em>}
                </span>
                <span className="top-jugadas">{fichas(p.jugadas)} jugadas</span>
                <span className="top-wager">{fichas(p.wager)}</span>
                <span className="top-gana">{p.premio ? `$${fichas(p.premio)}` : ''}</span>
              </li>
            ))}
          </ol>
        )}

        {/* Cuánto falta para entrar al podio. Es el número que hace que la tabla sirva de algo
            a quien no va ganando. */}
        {yo && !yo.premio && ultimoPremiado && (
          <p className="top-falta">
            Vas {yo.puesto}º. Te faltan{' '}
            <strong>{fichas(ultimoPremiado.wager - yo.wager + 1)}</strong> de wager para entrar al
            podio.
          </p>
        )}

        {historial.length > 0 && (
          <section className="bloque">
            <h2 className="ref-titulo">Ciclos cerrados</h2>
            <ul className="top-ciclos">
              {historial.map((c) => (
                <li key={c.id}>
                  <strong>{soloFecha(c.hasta)}</strong>
                  <span>
                    {c.puestos
                      .map((p) => `${MEDALLAS[p.puesto - 1] ?? p.puesto} ${p.usuario}`)
                      .join(' · ')}
                  </span>
                  <em>
                    {c.participantes} participantes
                    {c.pagado ? '' : ' · premios sin pagar'}
                  </em>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="pie">
          Cuenta lo apostado, no lo ganado: da igual si la mesa te trata bien o mal. El ciclo lo
          cierra el encargado, y al cerrarlo el podio recibe su premio <strong>en plata del
          juego</strong>: queda como solicitud de devolución a su nombre y el encargado se la
          entrega dentro del juego. Los contadores vuelven a cero.
        </p>
      </main>
    </div>
  );
}
