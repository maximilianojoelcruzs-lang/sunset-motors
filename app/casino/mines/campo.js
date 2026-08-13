'use client';

import { useState } from 'react';
import Sala, { Apuesta, fichas } from '../sala';
import { CASILLAS, MINAS, escaleraDe, maximasDe, pagoDe, probabilidadDe } from '../../../lib/mines';
import { APUESTA_MINIMA } from '../../../lib/fichas-limites';

/** Una casilla del campo. Tapada mientras no se sepa qué hay debajo. */
function Casilla({ i, estado, onTocar, bloqueada }) {
  return (
    <button
      type="button"
      className={`mina-casilla ${estado}`}
      disabled={bloqueada}
      onClick={() => onTocar(i)}
      aria-label={`Casilla ${i + 1}`}
    >
      {estado === 'limpia' && <span aria-hidden="true">💎</span>}
      {estado === 'mina' && <span aria-hidden="true">💣</span>}
      {estado === 'exploto' && <span aria-hidden="true">💥</span>}
    </button>
  );
}

export default function Campo({ usuario, admin, accesos, saldoInicial, partida }) {
  const [saldo, setSaldo] = useState(saldoInicial);
  const [apuesta, setApuesta] = useState(partida?.apuesta ?? 100);
  const [minas, setMinas] = useState(partida?.minas ?? 3);
  const [juego, setJuego] = useState(partida);
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const jugando = juego?.fase === 'jugando';
  const acabo = juego?.fase === 'fin';

  const pedir = async (accion, extra) => {
    setError('');
    setOcupado(true);
    try {
      const r = await fetch('/api/casino/mines', {
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
      if (datos.saldo !== undefined) setSaldo(datos.saldo);
    } catch {
      setError('Sin conexión con el servidor.');
    } finally {
      setOcupado(false);
    }
  };

  /** Qué hay en cada casilla, según lo que se sepa hasta ahora. */
  const estadoDe = (i) => {
    if (!juego) return 'tapada';
    if (acabo) {
      if (juego.exploto === i) return 'exploto';
      if (juego.sembradas?.includes(i)) return 'mina';
      if (juego.destapadas.includes(i)) return 'limpia';
      return 'tapada apagada';
    }
    return juego.destapadas.includes(i) ? 'limpia' : 'tapada';
  };

  const escalera = escaleraDe(minas);
  const llevadas = juego?.destapadas.length ?? 0;

  return (
    <Sala
      usuario={usuario}
      admin={admin}
      accesos={accesos}
      titulo="Mines"
      sub={`25 casillas · cobra cuando quieras · retorno al jugador 97%`}
      saldo={saldo}
      aviso="Las minas se siembran antes de la primera casilla y no salen del servidor hasta que
             termina la partida: no se deciden sobre la marcha. Da igual dónde te plantes — en
             la primera casilla o en la vigésima, el retorno es el mismo. Fichas de rol."
    >
      <div className="rasca-mesa">
        <section>
          <div className={`mina-campo ${acabo ? (juego.gano ? 'gano' : 'perdio') : ''}`}>
            {Array.from({ length: CASILLAS }, (_, i) => (
              <Casilla
                key={i}
                i={i}
                estado={estadoDe(i)}
                bloqueada={!jugando || ocupado}
                onTocar={(x) => pedir('destapar', { casilla: x })}
              />
            ))}
          </div>

          <div className={`resultado ${acabo ? (juego.gano ? 'gano' : 'perdio') : ''}`}>
            {jugando ? (
              <>
                <span className="rasca-multi">x{juego.pago || '—'}</span>
                <span className="resultado-texto">
                  {llevadas === 0
                    ? 'Destapa la primera'
                    : `${llevadas} limpia${llevadas > 1 ? 's' : ''} · la siguiente paga x${juego.siguiente}`}
                </span>
                <span className="resultado-neto">
                  {llevadas > 0 ? `Vale ${fichas(Math.round(juego.apuesta * juego.pago))} fichas` : ''}
                </span>
              </>
            ) : acabo ? (
              juego.gano ? (
                <>
                  <span className="rasca-multi">x{juego.multiplicador}</span>
                  <span className="resultado-texto">{fichas(juego.premio)} fichas</span>
                  <span className="resultado-neto">
                    {juego.neto >= 0 ? '+' : ''}
                    {fichas(juego.neto)}
                  </span>
                </>
              ) : (
                <>
                  <span className="resultado-texto">
                    {juego.exploto !== null && juego.exploto !== undefined
                      ? `Mina en la casilla ${juego.exploto + 1}`
                      : `Cobraste x${juego.multiplicador}`}
                  </span>
                  <span className="resultado-neto">{fichas(juego.neto)} fichas</span>
                </>
              )
            ) : (
              <span className="resultado-texto">Elige cuántas minas y empieza</span>
            )}
          </div>
        </section>

        <section>
          {jugando ? (
            <div className="apuesta-caja">
              <p className="poker-apostado">
                Apostaste <strong>{fichas(juego.apuesta)}</strong> · {juego.minas} minas
              </p>
              {error && <p className="apuesta-error">{error}</p>}
              <button
                type="button"
                className="apuesta-girar retirar"
                disabled={ocupado || llevadas === 0}
                onClick={() => pedir('cobrar')}
              >
                {llevadas === 0
                  ? 'Destapa una casilla'
                  : `Cobrar ${fichas(Math.round(juego.apuesta * juego.pago))}`}
              </button>
            </div>
          ) : (
            <>
              <div className="rasca-tabla">
                <h2 className="casino-titulo">Cuántas minas</h2>
                <div className="mina-cuantas">
                  {MINAS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      className={`plinko-punado ${minas === m ? 'activo' : ''}`}
                      onClick={() => {
                        setMinas(m);
                        setJuego(null);
                      }}
                    >
                      {m}
                    </button>
                  ))}
                </div>
                <p className="rasca-nota">
                  Con {minas} mina{minas > 1 ? 's' : ''}, la primera casilla paga x
                  {pagoDe(minas, 1)} y acierta el{' '}
                  {(probabilidadDe(minas, 1) * 100).toFixed(0)}% de las veces. Llegar hasta el
                  final paga x{pagoDe(minas, maximasDe(minas))}, y ahí se cobra solo.
                </p>
              </div>

              <Apuesta
                apuesta={apuesta}
                setApuesta={setApuesta}
                bloqueado={ocupado || apuesta < APUESTA_MINIMA || apuesta > saldo}
                error={error}
                onJugar={() => pedir('empezar', { apuesta, minas })}
                texto={ocupado ? 'Sembrando…' : `Jugar por ${fichas(apuesta)}`}
              />
            </>
          )}

          <div className="rasca-tabla">
            <h2 className="casino-titulo">Lo que paga plantarse</h2>
            <ul className="mina-escalera">
              {escalera.map((p) => (
                <li key={p.limpias} className={llevadas === p.limpias ? 'premiada' : ''}>
                  <span className="rasca-tres">{p.limpias} limpias</span>
                  <span className="rasca-paga">x{p.pago}</span>
                  <span className="rasca-prob">{(p.probabilidad * 100).toFixed(1)}%</span>
                </li>
              ))}
            </ul>
            <p className="rasca-nota">
              La columna de la derecha es cada cuánto se llega hasta ahí. El pago sale de esa
              misma probabilidad, así que plantarse temprano o tarde devuelve exactamente lo
              mismo a la larga: cambia cada cuánto ganas, no cuánto.
            </p>
          </div>
        </section>
      </div>
    </Sala>
  );
}
