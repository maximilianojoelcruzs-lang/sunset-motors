'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Sala, { fichas } from '../sala';
import { RETORNO, SURFISTAS, cuotaDe, probabilidadDe, surfista } from '../../../lib/surf';
import { APUESTA_MINIMA } from '../../../lib/fichas-limites';

const VALORES = [50, 100, 500, 1000];
const DURACION = 4200;

/** Una calle del mar, con su surfista corriendo hacia la orilla. */
function Calle({ s, avance, puesto, apostado, gano, onApostar, bloqueado }) {
  return (
    <button
      type="button"
      className={`calle ${apostado ? 'apostada' : ''} ${puesto === 1 ? 'gana' : ''}`}
      disabled={bloqueado}
      onClick={() => onApostar(s.id)}
      style={{ '--surf': s.color }}
    >
      <span className="calle-ficha">
        <span className="calle-nombre">{s.nombre}</span>
        <span className="calle-tabla">{s.tabla}</span>
      </span>

      <span className="calle-mar">
        <span className="calle-linea" aria-hidden="true" />
        <span className="calle-surfista" style={{ left: `${avance}%` }} aria-hidden="true">
          🏄
        </span>
        {puesto ? <span className={`calle-puesto p${puesto}`}>{puesto}º</span> : null}
      </span>

      <span className="calle-cuota">
        <strong>{cuotaDe(s.id).toFixed(2)}</strong>
        <em>{Math.round(probabilidadDe(s.id) * 100)}%</em>
      </span>

      {apostado ? (
        <span className={`calle-apostado ${gano ? 'cobro' : ''}`}>{fichas(apostado)}</span>
      ) : null}
    </button>
  );
}

export default function Carrera({ usuario, admin, accesos, saldoInicial }) {
  const [saldo, setSaldo] = useState(saldoInicial);
  const [ficha, setFicha] = useState(100);
  const [apuestas, setApuestas] = useState({});
  const [corriendo, setCorriendo] = useState(false);
  const [avances, setAvances] = useState({});
  const [ultima, setUltima] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [error, setError] = useState('');
  const relojes = useRef([]);

  useEffect(() => () => relojes.current.forEach(clearTimeout), []);

  const total = useMemo(
    () => Object.values(apuestas).reduce((s, n) => s + n, 0),
    [apuestas]
  );
  const cuantas = Object.keys(apuestas).length;

  const apostar = (id) => {
    if (corriendo) return;
    if (total + ficha > saldo) {
      setError('No te alcanzan las fichas para esa.');
      return;
    }
    setError('');
    setUltima(null);
    setApuestas((a) => ({ ...a, [id]: (a[id] ?? 0) + ficha }));
  };

  const limpiar = () => {
    if (corriendo) return;
    setApuestas({});
    setError('');
  };

  const largar = async () => {
    if (corriendo || !cuantas) return;
    setError('');
    setUltima(null);
    setCorriendo(true);
    setAvances({});

    try {
      const r = await fetch('/api/casino/surf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apuestas: Object.entries(apuestas).map(([id, monto]) => ({ id, monto })),
        }),
      });
      const cuerpo = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(cuerpo.error || 'No se pudo correr.');
        setCorriendo(false);
        return;
      }

      // La carrera ya se corrió en el servidor: acá solo se lleva a cada uno hasta donde
      // llegó. Los tirones intermedios son adorno; el orden final es el que vino.
      const meta = {};
      cuerpo.orden.forEach((id, i) => {
        meta[id] = 100 - i * 5.5;
      });

      relojes.current.forEach(clearTimeout);
      relojes.current = [];
      const tramos = 9;
      for (let t = 1; t <= tramos; t += 1) {
        relojes.current.push(
          setTimeout(() => {
            setAvances(() => {
              const paso = {};
              for (const s of SURFISTAS) {
                const fin = meta[s.id];
                // Cerca del final todos convergen a su sitio; antes se adelantan y se pasan.
                const ruido = t < tramos ? (Math.random() - 0.5) * 26 * (1 - t / tramos) : 0;
                paso[s.id] = Math.max(0, Math.min(100, (fin * t) / tramos + ruido));
              }
              return paso;
            });
          }, (t * DURACION) / tramos)
        );
      }

      relojes.current.push(
        setTimeout(() => {
          setCorriendo(false);
          setUltima(cuerpo);
          setSaldo(cuerpo.saldo);
          setHistorial((h) => [cuerpo, ...h].slice(0, 12));
        }, DURACION + 250)
      );
    } catch {
      setError('Sin conexión con el servidor.');
      setCorriendo(false);
    }
  };

  const puestoDe = (id) => (ultima ? ultima.orden.indexOf(id) + 1 : null);
  const acertadas = ultima?.resultados.filter((r) => r.gano) ?? [];

  return (
    <Sala
      usuario={usuario}
      admin={admin}
      accesos={accesos}
      titulo="Carrera de surf"
      sub={`Seis tablas, una ola · retorno al jugador ${Math.round(RETORNO * 100)}%`}
      saldo={saldo}
      aviso="Las cuotas se calculan desde la probabilidad de cada surfista, así que los seis
             dejan la misma ventaja a la casa: apostar al favorito o al que nadie mira da lo
             mismo a la larga. El orden de llegada lo sortea el servidor. Fichas de rol."
    >
      <div className="surf-mesa">
        <section>
          <div className={`surf-mar ${ultima?.gano ? 'gano' : ''}`}>
            {SURFISTAS.map((s) => (
              <Calle
                key={s.id}
                s={s}
                avance={avances[s.id] ?? 0}
                puesto={puestoDe(s.id)}
                apostado={apuestas[s.id] ?? 0}
                gano={acertadas.some((r) => r.id === s.id)}
                onApostar={apostar}
                bloqueado={corriendo}
              />
            ))}
          </div>

          <div className={`resultado ${ultima ? (ultima.gano ? 'gano' : 'perdio') : ''}`}>
            {corriendo ? (
              <span className="resultado-girando">Corriendo la ola…</span>
            ) : ultima ? (
              <>
                <span className="resultado-texto">
                  Ganó {surfista(ultima.orden[0]).nombre}
                  {acertadas.length ? ' · acertaste' : ''}
                </span>
                <span className="resultado-neto">
                  {ultima.neto >= 0 ? '+' : ''}
                  {fichas(ultima.neto)} fichas
                </span>
              </>
            ) : (
              <span className="resultado-texto">
                {cuantas
                  ? `${fichas(total)} en ${cuantas} surfista${cuantas > 1 ? 's' : ''}`
                  : 'Toca una calle para apostar'}
              </span>
            )}
          </div>

          {historial.length > 0 && (
            <div className="ruleta-historial">
              {historial.map((h, i) => (
                <span
                  key={i}
                  className="bolita"
                  style={{ background: surfista(h.orden[0]).color, color: '#0c0d16' }}
                >
                  {surfista(h.orden[0]).nombre.slice(0, 2)}
                </span>
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="apuesta-caja">
            <div className="apuesta-elegida">
              {cuantas ? (
                <>
                  <strong>{fichas(total)}</strong> en {cuantas} surfista
                  {cuantas > 1 ? 's' : ''}
                </>
              ) : (
                <>Elige una ficha y toca una calle</>
              )}
            </div>

            <div className="apuesta-fichas">
              {VALORES.map((v) => (
                <button
                  key={v}
                  type="button"
                  className={`ficha ${ficha === v ? 'activa' : ''}`}
                  disabled={corriendo}
                  onClick={() => setFicha(v)}
                >
                  {fichas(v)}
                </button>
              ))}
              <input
                type="number"
                className="apuesta-otro"
                min={APUESTA_MINIMA}
                value={ficha}
                disabled={corriendo}
                onChange={(e) => setFicha(Math.max(0, Number(e.target.value) || 0))}
                aria-label="Otra cantidad por apuesta"
              />
            </div>

            <div className="pano-mandos">
              <button type="button" onClick={limpiar} disabled={corriendo || !cuantas}>
                Limpiar
              </button>
            </div>

            {error && <p className="apuesta-error">{error}</p>}

            <button
              type="button"
              className="apuesta-girar"
              onClick={largar}
              disabled={corriendo || !cuantas || ficha < APUESTA_MINIMA || total > saldo}
            >
              {corriendo ? 'Corriendo…' : cuantas ? `Largar por ${fichas(total)}` : 'Apuesta primero'}
            </button>
          </div>

          <div className="rasca-tabla">
            <h2 className="casino-titulo">Cuotas</h2>
            <ul>
              {SURFISTAS.map((s) => (
                <li key={s.id}>
                  <span className="rasca-tres" style={{ color: s.color }}>
                    {s.nombre}
                  </span>
                  <span className="rasca-paga">{cuotaDe(s.id).toFixed(2)}</span>
                  <span className="rasca-prob">
                    {Math.round(probabilidadDe(s.id) * 100)}%
                  </span>
                </li>
              ))}
            </ul>
            <p className="rasca-nota">
              La cuota sale de dividir {RETORNO} por la probabilidad. Por eso Kala gana 3 de
              cada 10 olas y paga 3,17 en vez de 3,33: esa diferencia, igual en los seis, es
              lo que se queda la casa.
            </p>
          </div>
        </section>
      </div>
    </Sala>
  );
}
