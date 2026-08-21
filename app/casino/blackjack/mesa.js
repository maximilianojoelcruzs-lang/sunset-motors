'use client';

import { useState } from 'react';
import Sala, { Apuesta, fichas } from '../sala';
import Carta from '../carta';
import { REGLAS } from '../../../lib/blackjack';
import { APUESTA_MINIMA } from '../../../lib/fichas-limites';

/** Una mano: sus cartas, su total y en qué quedó. */
function Mano({ mano, activa, sola }) {
  return (
    <div className={`bj-mano ${activa ? 'activa' : ''} ${mano.estado ? 'cerrada' : ''}`}>
      <div className="bj-cartas">
        {mano.cartas.map((c, i) => (
          <Carta key={i} carta={c} />
        ))}
      </div>

      <div className="bj-pie">
        <span className={`bj-total ${mano.pasada ? 'pasado' : ''}`}>
          {mano.blackjack ? 'Blackjack' : mano.total}
          {mano.blanda && !mano.blackjack ? ' blando' : ''}
        </span>
        {!sola || mano.doblada ? (
          <span className="bj-apuesta">
            {fichas(mano.apuesta)}
            {mano.doblada ? ' · doblada' : ''}
          </span>
        ) : null}
      </div>

      {mano.estado ? (
        <span className={`bj-veredicto ${mano.premio > mano.apuesta ? 'bien' : mano.premio ? 'igual' : 'mal'}`}>
          {mano.estado}
        </span>
      ) : null}
    </div>
  );
}

export default function Mesa({ usuario, admin, accesos, saldoInicial, partida }) {
  const [saldo, setSaldo] = useState(partida?.saldo ?? saldoInicial);
  const [apuesta, setApuesta] = useState(partida?.apuestaTotal ?? 100);
  const [juego, setJuego] = useState(partida);
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const jugando = juego?.fase === 'jugando';
  const acabo = juego?.fase === 'fin';

  const pedir = async (accion, extra) => {
    setError('');
    setOcupado(true);
    try {
      const r = await fetch('/api/casino/blackjack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion, ...extra }),
      });
      const datos = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(datos.error || 'No se pudo jugar.');
        return;
      }
      setJuego(datos);
      setSaldo(datos.saldo);
    } catch {
      setError('Sin conexión con el servidor.');
    } finally {
      setOcupado(false);
    }
  };

  const puede = juego?.puede ?? {};
  const sola = (juego?.manos.length ?? 1) === 1;

  return (
    <Sala
      usuario={usuario}
      admin={admin}
      accesos={accesos}
      titulo="Blackjack"
      sub="6 mazos · el crupier se planta en 17 · el blackjack paga 3 a 2"
      saldo={saldo}
      onSaldo={setSaldo}
      aviso="El zapato se baraja entero en el servidor antes de repartir, y la carta tapada del
             crupier se queda ahí hasta que terminas: no viaja al navegador. Fichas de rol — no
             valen dinero."
    >
      <div className="bj-mesa">
        <section>
          <div className="bj-lado">
            <span className="bj-rotulo">Crupier</span>
            <div className="bj-cartas">
              {juego ? (
                <>
                  {juego.crupier.cartas.map((c, i) => (
                    <Carta key={i} carta={c} />
                  ))}
                  {juego.crupier.tapada ? <Carta tapada /> : null}
                </>
              ) : (
                <>
                  <Carta tapada />
                  <Carta tapada />
                </>
              )}
            </div>
            {juego ? (
              <span className={`bj-total ${juego.crupier.pasada ? 'pasado' : ''}`}>
                {juego.crupier.blackjack
                  ? 'Blackjack'
                  : juego.crupier.tapada
                    ? `${juego.crupier.total} + tapada`
                    : juego.crupier.total}
              </span>
            ) : null}
          </div>

          <div className="bj-lado tuyo">
            <span className="bj-rotulo">{sola ? 'Tu mano' : 'Tus manos'}</span>
            <div className={`bj-manos ${acabo && juego.gano ? 'gano' : ''}`}>
              {juego ? (
                juego.manos.map((m, i) => (
                  <Mano key={i} mano={m} activa={juego.activa === i} sola={sola} />
                ))
              ) : (
                <div className="bj-mano">
                  <div className="bj-cartas">
                    <Carta tapada />
                    <Carta tapada />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className={`resultado ${acabo ? (juego.gano ? 'gano' : 'perdio') : ''}`}>
            {jugando ? (
              <>
                <span className="resultado-texto">
                  {sola ? 'Tu turno' : `Mano ${juego.activa + 1} de ${juego.manos.length}`}
                </span>
                <span className="resultado-neto">
                  En juego: {fichas(juego.apuestaTotal)} fichas
                </span>
              </>
            ) : acabo ? (
              <>
                <span className="resultado-texto">
                  {juego.manos.map((m) => m.estado).join(' · ')}
                </span>
                <span className="resultado-neto">
                  {juego.neto >= 0 ? '+' : ''}
                  {fichas(juego.neto)} fichas
                </span>
              </>
            ) : (
              <span className="resultado-texto">Pon tu apuesta y reparto</span>
            )}
          </div>
        </section>

        <section>
          <div className="rasca-tabla">
            <h2 className="casino-titulo">Reglas de la mesa</h2>
            <ul className="bj-reglas">
              {REGLAS.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            <p className="rasca-nota">
              Con estas reglas y jugando bien, a la casa le queda cerca del 0,5%: es el mejor
              juego de la sala. Acá tus decisiones cambian el resultado, así que el margen
              depende de cómo juegues y no solo de la tabla.
            </p>
          </div>

          {jugando ? (
            <div className="apuesta-caja">
              <p className="poker-apostado">
                Apostado <strong>{fichas(juego.apuestaTotal)}</strong> fichas
              </p>
              {error && <p className="apuesta-error">{error}</p>}
              <div className="bj-acciones">
                <button
                  type="button"
                  className="apuesta-girar"
                  disabled={ocupado || !puede.pedir}
                  onClick={() => pedir('pedir')}
                >
                  Pedir
                </button>
                <button
                  type="button"
                  className="apuesta-girar suave"
                  disabled={ocupado}
                  onClick={() => pedir('plantarse')}
                >
                  Plantarse
                </button>
                <button
                  type="button"
                  className="apuesta-girar suave"
                  disabled={ocupado || !puede.doblar}
                  onClick={() => pedir('doblar')}
                >
                  Doblar
                </button>
                <button
                  type="button"
                  className="apuesta-girar suave"
                  disabled={ocupado || !puede.separar}
                  onClick={() => pedir('separar')}
                >
                  Separar
                </button>
              </div>
            </div>
          ) : (
            <Apuesta
              apuesta={apuesta}
              setApuesta={setApuesta}
              bloqueado={ocupado || apuesta < APUESTA_MINIMA || apuesta > saldo}
              error={error}
              onJugar={() => pedir('repartir', { apuesta })}
              texto={ocupado ? 'Repartiendo…' : `Repartir por ${fichas(apuesta)}`}
            />
          )}
        </section>
      </div>
    </Sala>
  );
}
