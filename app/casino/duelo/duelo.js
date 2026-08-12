'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Sala, { fichas } from '../sala';
import Carta from '../carta';
import { APUESTAS, PAGA_EMPATE, nombreRango, rango } from '../../../lib/duelo';
import { APUESTA_MINIMA, FICHAS } from '../../../lib/fichas-limites';

/** Lo que tarda en darse vuelta cada carta. */
const VUELTA = 700;

const SITIOS = [
  { id: 'rojo', clase: 'rojo' },
  { id: 'empate', clase: 'empate' },
  { id: 'azul', clase: 'azul' },
];

/** El sitio donde se pone la ficha, con lo que paga y su ventaja a la vista. */
function Sitio({ id, clase, puesto, gana, onPoner, onQuitar, bloqueado }) {
  const def = APUESTAS[id];
  return (
    <button
      type="button"
      className={`duelo-sitio ${clase} ${puesto ? 'con-ficha' : ''} ${gana ? 'gana' : ''}`}
      disabled={bloqueado}
      onClick={() => onPoner(id)}
      onContextMenu={(e) => {
        e.preventDefault();
        onQuitar(id);
      }}
    >
      <strong>{def.etiqueta}</strong>
      <span className="duelo-paga">{def.paga} a 1</span>
      <em className="duelo-ventaja">casa {(def.ventaja * 100).toFixed(2)}%</em>
      {puesto ? <span className="ficha-puesta">{fichas(puesto)}</span> : null}
    </button>
  );
}

export default function Duelo({ usuario, admin, accesos, saldoInicial }) {
  const [saldo, setSaldo] = useState(saldoInicial);
  const [ficha, setFicha] = useState(100);
  const [apuestas, setApuestas] = useState({});
  const [repartiendo, setRepartiendo] = useState(false);
  const [mano, setMano] = useState(null); // las cartas ya dadas vuelta
  const [ultima, setUltima] = useState(null); // el resultado, cuando ya se vieron las dos
  const [historial, setHistorial] = useState([]);
  const [error, setError] = useState('');
  const relojes = useRef([]);

  useEffect(() => () => relojes.current.forEach(clearTimeout), []);

  const total = useMemo(
    () => Object.values(apuestas).reduce((s, n) => s + n, 0),
    [apuestas]
  );
  const cuantas = Object.keys(apuestas).length;

  const poner = (id) => {
    if (repartiendo) return;
    if (total + ficha > saldo) {
      setError('No te alcanzan las fichas para esa.');
      return;
    }
    setError('');
    setUltima(null);
    setMano(null);
    setApuestas((a) => ({ ...a, [id]: (a[id] ?? 0) + ficha }));
  };

  const quitar = (id) => {
    if (repartiendo || !apuestas[id]) return;
    setApuestas((a) => {
      const { [id]: _fuera, ...resto } = a;
      return resto;
    });
  };

  const limpiar = () => {
    if (repartiendo) return;
    setApuestas({});
    setError('');
  };

  const repartir = async () => {
    if (repartiendo || !cuantas) return;
    setError('');
    setUltima(null);
    setMano(null);
    setRepartiendo(true);

    try {
      const r = await fetch('/api/casino/duelo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apuestas: Object.entries(apuestas).map(([id, monto]) => ({ id, monto })),
        }),
      });
      const cuerpo = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(cuerpo.error || 'No se pudo repartir.');
        setRepartiendo(false);
        return;
      }

      // Las dos cartas ya vinieron decididas; se enseñan de a una para que se vea el duelo.
      relojes.current.forEach(clearTimeout);
      relojes.current = [
        setTimeout(() => setMano({ rojo: cuerpo.rojo }), VUELTA),
        setTimeout(() => setMano({ rojo: cuerpo.rojo, azul: cuerpo.azul }), VUELTA * 2),
        setTimeout(() => {
          setRepartiendo(false);
          setUltima(cuerpo);
          setSaldo(cuerpo.saldo);
          setHistorial((h) => [cuerpo, ...h].slice(0, 16));
        }, VUELTA * 2 + 350),
      ];
    } catch {
      setError('Sin conexión con el servidor.');
      setRepartiendo(false);
    }
  };

  const gano = (id) => ultima?.resultados.some((r) => r.id === id && r.gano);
  const mitades = ultima?.resultados.filter((r) => r.mitad) ?? [];

  return (
    <Sala
      usuario={usuario}
      admin={admin}
      accesos={accesos}
      titulo="Duelo de cartas"
      sub="Una carta por bando, gana la más alta · el as vale 1"
      saldo={saldo}
      aviso="Si sale empate, quien apostó a un bando pierde la mitad: de ahí sale la ventaja de
             la casa en este juego, y es la misma regla de un Dragon Tiger de verdad. Las dos
             cartas las reparte el servidor. Fichas de rol — no valen dinero."
    >
      <div className="rasca-mesa">
        <section>
          <div className={`duelo-mesa ${ultima?.gano ? 'gano' : ''}`}>
            <div className={`duelo-bando rojo ${ultima?.ganador === 'rojo' ? 'gana' : ''}`}>
              <span className="duelo-rotulo">Rojo</span>
              <Carta carta={mano?.rojo} tapada={!mano?.rojo} />
              <span className="duelo-rango">
                {mano?.rojo ? nombreRango(rango(mano.rojo)) : '—'}
              </span>
            </div>

            <span className="duelo-contra" aria-hidden="true">
              {ultima?.ganador === 'empate' ? '=' : 'vs'}
            </span>

            <div className={`duelo-bando azul ${ultima?.ganador === 'azul' ? 'gana' : ''}`}>
              <span className="duelo-rotulo">Azul</span>
              <Carta carta={mano?.azul} tapada={!mano?.azul} />
              <span className="duelo-rango">
                {mano?.azul ? nombreRango(rango(mano.azul)) : '—'}
              </span>
            </div>
          </div>

          <div className="duelo-sitios">
            {SITIOS.map((s) => (
              <Sitio
                key={s.id}
                id={s.id}
                clase={s.clase}
                puesto={apuestas[s.id] ?? 0}
                gana={gano(s.id)}
                onPoner={poner}
                onQuitar={quitar}
                bloqueado={repartiendo}
              />
            ))}
          </div>

          <div className={`resultado ${ultima ? (ultima.gano ? 'gano' : 'perdio') : ''}`}>
            {repartiendo ? (
              <span className="resultado-girando">Repartiendo…</span>
            ) : ultima ? (
              <>
                <span className="resultado-texto">
                  {ultima.ganador === 'empate'
                    ? `Empate en ${nombreRango(rango(ultima.rojo))}`
                    : `Gana ${APUESTAS[ultima.ganador].etiqueta}`}
                  {mitades.length ? ' · te devuelve la mitad' : ''}
                </span>
                <span className="resultado-neto">
                  {ultima.neto >= 0 ? '+' : ''}
                  {fichas(ultima.neto)} fichas
                </span>
              </>
            ) : (
              <span className="resultado-texto">
                {cuantas ? `${fichas(total)} en la mesa` : 'Pon una ficha y reparto'}
              </span>
            )}
          </div>

          {historial.length > 0 && (
            <div className="ruleta-historial">
              {historial.map((h, i) => (
                <span key={i} className={`bolita duelo-${h.ganador}`}>
                  {h.ganador === 'empate' ? '=' : h.ganador === 'rojo' ? 'R' : 'A'}
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
                  <strong>{fichas(total)}</strong> en {cuantas} sitio
                  {cuantas > 1 ? 's' : ''}
                </>
              ) : (
                <>Elige una ficha y toca un sitio</>
              )}
            </div>

            <div className="apuesta-fichas">
              {FICHAS.map((v) => (
                <button
                  key={v}
                  type="button"
                  className={`ficha ${ficha === v ? 'activa' : ''}`}
                  disabled={repartiendo}
                  onClick={() => setFicha(v)}
                >
                  {fichas(v)}
                </button>
              ))}
              <output className="apuesta-otro" aria-label="Valor de la ficha">
                {fichas(ficha)}
              </output>
            </div>

            <div className="pano-mandos">
              <button type="button" onClick={limpiar} disabled={repartiendo || !cuantas}>
                Limpiar
              </button>
            </div>

            {error && <p className="apuesta-error">{error}</p>}

            <button
              type="button"
              className="apuesta-girar"
              onClick={repartir}
              disabled={repartiendo || !cuantas || ficha < APUESTA_MINIMA || total > saldo}
            >
              {repartiendo ? 'Repartiendo…' : cuantas ? `Repartir por ${fichas(total)}` : 'Apuesta primero'}
            </button>
          </div>

          <div className="rasca-tabla">
            <h2 className="casino-titulo">Cómo se juega</h2>
            <ul>
              <li>
                <span className="rasca-tres">Rojo o Azul</span>
                <span className="rasca-paga">1 a 1</span>
                <span className="rasca-prob">3,70%</span>
              </li>
              <li>
                <span className="rasca-tres">Empate</span>
                <span className="rasca-paga">{PAGA_EMPATE} a 1</span>
                <span className="rasca-prob">11,25%</span>
              </li>
            </ul>
            <p className="rasca-nota">
              La columna de la derecha es lo que se queda la casa. Una carta a cada bando, gana
              la más alta y el palo da igual: el as vale 1 y el rey 13. El empate sale 7 de cada
              100 manos — paga mucho, pero es de lejos la peor apuesta de la mesa.
            </p>
          </div>
        </section>
      </div>
    </Sala>
  );
}
