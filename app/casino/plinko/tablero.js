'use client';

import { useEffect, useRef, useState } from 'react';
import Sala, { Apuesta, fichas } from '../sala';
import { CASILLAS, FILAS, TABLAS, probabilidadDe, retornoDe } from '../../../lib/plinko';
import { APUESTA_MINIMA } from '../../../lib/fichas-limites';

/** Medio hueco entre clavos, en % del ancho. De acá salen todas las posiciones. */
const PASO = 50 / CASILLAS;

/** Dónde está la bolita tras `i` rebotes, de los cuales `derechas` fueron a la derecha. */
const equis = (i, derechas) => 50 + (2 * derechas - i) * PASO;

/** Los clavos: la fila `i` tiene `i + 1`, justo en los sitios por donde puede pasar. */
const CLAVOS = Array.from({ length: FILAS }, (_, i) =>
  Array.from({ length: i + 1 }, (_, j) => ({ x: equis(i, j), y: (i / FILAS) * 100 }))
).flat();

/** Cómo se pinta una casilla según lo que pague. */
const calor = (m) => (m >= 10 ? 'ardiente' : m >= 2 ? 'buena' : m >= 1 ? 'tibia' : 'fria');

export default function Tablero({ usuario, admin, accesos, saldoInicial }) {
  const [saldo, setSaldo] = useState(saldoInicial);
  const [apuesta, setApuesta] = useState(100);
  const [riesgo, setRiesgo] = useState('medio');
  const [paso, setPaso] = useState({ i: 0, derechas: 0 });
  const [cayendo, setCayendo] = useState(false);
  const [ultima, setUltima] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [error, setError] = useState('');
  const relojes = useRef([]);

  // Si alguien se va de la mesa a mitad de caída, no dejamos temporizadores sueltos.
  useEffect(() => () => relojes.current.forEach(clearTimeout), []);

  const tabla = TABLAS[riesgo];
  const retorno = (retornoDe(riesgo) * 100).toFixed(2);

  const jugar = async () => {
    if (cayendo) return;
    setError('');
    setUltima(null);
    setCayendo(true);
    setPaso({ i: 0, derechas: 0 });

    try {
      const r = await fetch('/api/casino/plinko', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apuesta, riesgo }),
      });
      const cuerpo = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(cuerpo.error || 'No se pudo jugar.');
        setCayendo(false);
        return;
      }

      // La bolita recorre el camino que ya vino decidido. Acá no se sortea nada.
      relojes.current.forEach(clearTimeout);
      relojes.current = cuerpo.camino.map((_, i) =>
        setTimeout(() => {
          const derechas = cuerpo.camino.slice(0, i + 1).reduce((s, p) => s + p, 0);
          setPaso({ i: i + 1, derechas });
        }, (i + 1) * 90)
      );

      relojes.current.push(
        setTimeout(
          () => {
            setCayendo(false);
            setUltima(cuerpo);
            setSaldo(cuerpo.saldo);
            setHistorial((h) => [cuerpo, ...h].slice(0, 14));
          },
          (FILAS + 1) * 90
        )
      );
    } catch {
      setError('Sin conexión con el servidor.');
      setCayendo(false);
    }
  };

  return (
    <Sala
      usuario={usuario}
      admin={admin}
      accesos={accesos}
      titulo="Plinko"
      sub={`12 filas de clavos · retorno al jugador ${retorno}%`}
      saldo={saldo}
      aviso="Cada rebote es una moneda al aire que sortea el servidor, y por eso el centro se
             llena y las puntas casi nunca salen. Elegir riesgo cambia cómo se gana, no cuánto:
             las tres tablas devuelven lo mismo a la larga. Fichas de rol — no valen dinero."
    >
      <div className="rasca-mesa">
        <section>
          <div className={`plinko ${ultima?.gano ? 'gano' : ''}`}>
            <div className="plinko-campo">
              {CLAVOS.map((c, i) => (
                <span
                  key={i}
                  className="clavo"
                  style={{ left: `${c.x}%`, top: `${c.y}%` }}
                  aria-hidden="true"
                />
              ))}

              <span
                className={`bolita-plinko ${cayendo || paso.i ? 'viva' : ''}`}
                style={{
                  left: `${equis(paso.i, paso.derechas)}%`,
                  top: `${(paso.i / FILAS) * 100}%`,
                }}
                aria-hidden="true"
              />
            </div>

            <div className="plinko-casillas">
              {tabla.pagos.map((m, k) => (
                <span
                  key={k}
                  className={`casilla-plinko ${calor(m)} ${
                    ultima && ultima.casilla === k ? 'acertada' : ''
                  }`}
                  title={`1 de cada ${Math.round(1 / probabilidadDe(k)).toLocaleString('es-CL')}`}
                >
                  x{m}
                </span>
              ))}
            </div>
          </div>

          <div className={`resultado ${ultima ? (ultima.gano ? 'gano' : 'perdio') : ''}`}>
            {cayendo ? (
              <span className="resultado-girando">Cayendo…</span>
            ) : ultima ? (
              <>
                <span className="rasca-multi">x{ultima.multiplicador}</span>
                <span className="resultado-texto">
                  Casilla {ultima.casilla} · {fichas(ultima.premio)} fichas
                </span>
                <span className="resultado-neto">
                  {ultima.neto >= 0 ? '+' : ''}
                  {fichas(ultima.neto)}
                </span>
              </>
            ) : (
              <span className="resultado-texto">Suelta la bolita</span>
            )}
          </div>

          {historial.length > 0 && (
            <div className="ruleta-historial">
              {historial.map((h, i) => (
                <span key={i} className={`bolita ${calor(h.multiplicador)}`}>
                  x{h.multiplicador}
                </span>
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="rasca-tabla">
            <h2 className="casino-titulo">Riesgo</h2>
            <div className="plinko-riesgos">
              {Object.entries(TABLAS).map(([id, t]) => (
                <button
                  key={id}
                  type="button"
                  className={`plinko-riesgo ${riesgo === id ? 'activo' : ''}`}
                  disabled={cayendo}
                  onClick={() => {
                    setRiesgo(id);
                    setUltima(null);
                  }}
                >
                  <strong>{t.nombre}</strong>
                  <span>{t.lema}</span>
                  <em>hasta x{t.pagos[0]}</em>
                </button>
              ))}
            </div>
            <p className="rasca-nota">
              Las tres tablas devuelven el mismo {retorno}%: lo único que cambia es el reparto.
              En la alta, la punta paga x{TABLAS.alto.pagos[0]} y sale 1 de cada 4.096 bolitas;
              en la baja casi nunca te vas con las manos vacías.
            </p>
          </div>

          <Apuesta
            apuesta={apuesta}
            setApuesta={setApuesta}
            minimo={APUESTA_MINIMA}
            bloqueado={cayendo || apuesta < APUESTA_MINIMA || apuesta > saldo}
            error={error}
            onJugar={jugar}
            texto={cayendo ? 'Cayendo…' : `Soltar por ${fichas(apuesta)}`}
          />
        </section>
      </div>
    </Sala>
  );
}
