'use client';

import { useRef, useState } from 'react';
import Barra from '../../barra';
import Rueda, { anguloDe } from './rueda';
import { APUESTAS, esRojo } from '../../../lib/ruleta';
import { APUESTA_MINIMA } from '../../../lib/fichas-limites';

const fmt = new Intl.NumberFormat('es-CL');
const fichas = (n) => fmt.format(n);

/** Los 36 números en la disposición del paño: 3 filas, 12 columnas. */
const PANO = Array.from({ length: 12 }, (_, c) => [3 + c * 3, 2 + c * 3, 1 + c * 3]);

const FUERA = [
  ['docena1', 'docena2', 'docena3'],
  ['falta', 'par', 'rojo', 'negro', 'impar', 'pasa'],
  ['columna1', 'columna2', 'columna3'],
];

export default function Mesa({ usuario, admin, saldoInicial }) {
  const [saldo, setSaldo] = useState(saldoInicial);
  const [apuesta, setApuesta] = useState(100);
  const [eleccion, setEleccion] = useState({ tipo: 'rojo', valor: null });
  const [angulo, setAngulo] = useState(0);
  const [girando, setGirando] = useState(false);
  const [ultima, setUltima] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [error, setError] = useState('');
  const [turno, setTurno] = useState(null);
  const vueltas = useRef(0);

  const etiquetaEleccion =
    eleccion.tipo === 'pleno'
      ? `Pleno al ${eleccion.valor}`
      : APUESTAS[eleccion.tipo]?.etiqueta ?? '';

  const jugar = async () => {
    if (girando) return;
    setError('');
    setUltima(null);
    setGirando(true);

    try {
      const r = await fetch('/api/casino/ruleta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: eleccion.tipo, valor: eleccion.valor, apuesta }),
      });
      const cuerpo = await r.json().catch(() => ({}));

      if (!r.ok) {
        setError(cuerpo.error || 'No se pudo jugar.');
        setGirando(false);
        return;
      }

      // La rueda gira hasta el número que ya decidió el servidor. Se acumulan vueltas para
      // que cada tirada siga girando hacia adelante y no retroceda.
      vueltas.current += 6;
      setAngulo(anguloDe(cuerpo.numero, vueltas.current));

      // Se espera a que termine la animación antes de mostrar el resultado: contarlo antes
      // arruinaría la gracia.
      setTimeout(() => {
        setGirando(false);
        setUltima(cuerpo);
        setSaldo(cuerpo.saldo);
        setHistorial((h) => [cuerpo, ...h].slice(0, 12));
      }, 4200);
    } catch {
      setError('Sin conexión con el servidor.');
      setGirando(false);
    }
  };

  const elegir = (tipo, valor = null) => !girando && setEleccion({ tipo, valor });
  const activa = (tipo, valor = null) =>
    eleccion.tipo === tipo && eleccion.valor === valor ? 'activa' : '';

  return (
    <div className="casino">
      <Barra
        usuario={usuario}
        admin={admin}
        seccion="casino"
        variante="casino"
        turno={turno}
        onTurnoCambio={setTurno}
      />

      <div className="casino-fondo" aria-hidden="true">
        <span className="casino-halo halo-1" />
        <span className="casino-halo halo-2" />
        <span className="casino-reja" />
      </div>

      <main className="casino-cuerpo">
        <header className="mesa-cabeza">
          <div>
            <a className="mesa-volver" href="/casino">
              ← Volver a las mesas
            </a>
            <h1 className="mesa-titulo">Ruleta</h1>
            <p className="mesa-sub">Europea, un solo cero · ventaja de la casa 2,70%</p>
          </div>
          <div className="casino-fichas">
            <span className="fichas-rotulo">Tus fichas</span>
            <span className="fichas-cifra">{fichas(saldo)}</span>
          </div>
        </header>

        <div className="ruleta-mesa">
          <section className="ruleta-lado">
            <Rueda angulo={angulo} girando={girando} />

            <div className={`resultado ${ultima ? (ultima.gano ? 'gano' : 'perdio') : ''}`}>
              {girando ? (
                <span className="resultado-girando">Girando…</span>
              ) : ultima ? (
                <>
                  <span className={`resultado-numero ${ultima.color}`}>{ultima.numero}</span>
                  <span className="resultado-texto">
                    {ultima.gano ? `¡Ganaste ${fichas(ultima.premio)}!` : 'No fue esta vez'}
                  </span>
                  <span className="resultado-neto">
                    {ultima.neto >= 0 ? '+' : ''}
                    {fichas(ultima.neto)} fichas
                  </span>
                </>
              ) : (
                <span className="resultado-texto">Haz tu apuesta</span>
              )}
            </div>

            {historial.length > 0 && (
              <div className="ruleta-historial">
                {historial.map((h, i) => (
                  <span key={i} className={`bolita ${h.color}`}>
                    {h.numero}
                  </span>
                ))}
              </div>
            )}
          </section>

          <section className="ruleta-lado">
            <div className="pano">
              <button
                type="button"
                className={`pano-cero ${activa('pleno', 0)}`}
                onClick={() => elegir('pleno', 0)}
              >
                0
              </button>

              <div className="pano-numeros">
                {PANO.map((col, i) => (
                  <div className="pano-columna" key={i}>
                    {col.map((n) => (
                      <button
                        key={n}
                        type="button"
                        className={`pano-numero ${esRojo(n) ? 'rojo' : 'negro'} ${activa('pleno', n)}`}
                        onClick={() => elegir('pleno', n)}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                ))}
              </div>

              <div className="pano-fuera">
                {FUERA.map((fila, i) => (
                  <div className="pano-fila" key={i}>
                    {fila.map((t) => (
                      <button
                        key={t}
                        type="button"
                        className={`pano-opcion ${t} ${activa(t)}`}
                        onClick={() => elegir(t)}
                      >
                        {APUESTAS[t].etiqueta}
                        <span className="pano-paga">{APUESTAS[t].paga}:1</span>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            <div className="apuesta-caja">
              <div className="apuesta-elegida">
                Apuestas a <strong>{etiquetaEleccion}</strong>
              </div>

              <div className="apuesta-fichas">
                {[50, 100, 500, 1000].map((v) => (
                  <button
                    key={v}
                    type="button"
                    className={`ficha ${apuesta === v ? 'activa' : ''}`}
                    disabled={girando}
                    onClick={() => setApuesta(v)}
                  >
                    {fichas(v)}
                  </button>
                ))}
                <input
                  type="number"
                  className="apuesta-otro"
                  min={APUESTA_MINIMA}
                  value={apuesta}
                  disabled={girando}
                  onChange={(e) => setApuesta(Math.max(0, Number(e.target.value) || 0))}
                  aria-label="Otra cantidad"
                />
              </div>

              {error && <p className="apuesta-error">{error}</p>}

              <button
                type="button"
                className="apuesta-girar"
                onClick={jugar}
                disabled={girando || apuesta < APUESTA_MINIMA || apuesta > saldo}
              >
                {girando ? 'Girando…' : `Girar por ${fichas(apuesta)}`}
              </button>
            </div>
          </section>
        </div>

        <p className="casino-aviso">
          El número lo sortea el servidor, no tu navegador. Los pagos son los de una ruleta
          europea real: la casa gana un 2,70% a la larga, en todas las apuestas por igual.
          Fichas de rol — no valen dinero ni se convierten en dinero.
        </p>
      </main>
    </div>
  );
}
