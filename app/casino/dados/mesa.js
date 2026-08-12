'use client';

import { useState } from 'react';
import Sala, { Apuesta, fichas } from '../sala';
import { APUESTAS, TOTALES } from '../../../lib/dados';
import { APUESTA_MINIMA } from '../../../lib/fichas-limites';

/** Las caras de un dado, dibujadas con puntos. */
const PUNTOS = {
  1: [[50, 50]],
  2: [[28, 28], [72, 72]],
  3: [[28, 28], [50, 50], [72, 72]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
  6: [[28, 25], [72, 25], [28, 50], [72, 50], [28, 75], [72, 75]],
};

function Dado({ cara, rodando }) {
  return (
    <svg className={`dado ${rodando ? 'rodando' : ''}`} viewBox="0 0 100 100" aria-label={`Dado: ${cara}`}>
      <rect x="4" y="4" width="92" height="92" rx="18" className="dado-cuerpo" />
      {(PUNTOS[cara] ?? []).map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="9" className="dado-punto" />
      ))}
    </svg>
  );
}

const SENCILLAS = ['pequeno', 'grande', 'par', 'impar'];

export default function Mesa({ usuario, admin, accesos, saldoInicial }) {
  const [saldo, setSaldo] = useState(saldoInicial);
  const [apuesta, setApuesta] = useState(100);
  const [eleccion, setEleccion] = useState({ tipo: 'pequeno', valor: null });
  const [dados, setDados] = useState([1, 1, 1]);
  const [rodando, setRodando] = useState(false);
  const [ultima, setUltima] = useState(null);
  const [error, setError] = useState('');

  const etiqueta =
    eleccion.tipo === 'total'
      ? `Total ${eleccion.valor}`
      : eleccion.tipo === 'tripleExacto'
        ? `Triple de ${eleccion.valor}`
        : APUESTAS[eleccion.tipo]?.etiqueta;

  const jugar = async () => {
    if (rodando) return;
    setError('');
    setUltima(null);
    setRodando(true);

    try {
      const r = await fetch('/api/casino/dados', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: eleccion.tipo, valor: eleccion.valor, apuesta }),
      });
      const cuerpo = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(cuerpo.error || 'No se pudo jugar.');
        setRodando(false);
        return;
      }

      // Los dados dan vueltas un momento antes de mostrar lo que ya salió.
      setTimeout(() => {
        setDados(cuerpo.dados);
        setRodando(false);
        setUltima(cuerpo);
        setSaldo(cuerpo.saldo);
      }, 900);
    } catch {
      setError('Sin conexión con el servidor.');
      setRodando(false);
    }
  };

  const elegir = (tipo, valor = null) => !rodando && setEleccion({ tipo, valor });
  const activa = (tipo, valor = null) =>
    eleccion.tipo === tipo && eleccion.valor === valor ? 'activa' : '';

  return (
    <Sala
      usuario={usuario}
      admin={admin}
      accesos={accesos}
      titulo="Dados"
      sub="Sic Bo, tres dados · las apuestas sencillas pagan 1:1 con 2,78% de ventaja"
      saldo={saldo}
      aviso="Los dados los tira el servidor. Cada apuesta muestra su ventaja de la casa real:
             las sencillas son las buenas, las de triple pagan mucho y valen poco — igual que
             en una mesa de verdad. Fichas de rol, no valen dinero."
    >
      <div className="ruleta-mesa">
        <section className="ruleta-lado">
          <div className="dados-caja">
            {dados.map((c, i) => (
              <Dado key={i} cara={c} rodando={rodando} />
            ))}
          </div>

          <div className={`resultado ${ultima ? (ultima.gano ? 'gano' : 'perdio') : ''}`}>
            {rodando ? (
              <span className="resultado-girando">Rodando…</span>
            ) : ultima ? (
              <>
                <span className="dados-suma">{ultima.suma}</span>
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
        </section>

        <section className="ruleta-lado">
          <div className="pano dados-pano">
            <div className="pano-fila">
              {SENCILLAS.map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`pano-opcion ${activa(t)}`}
                  onClick={() => elegir(t)}
                >
                  {APUESTAS[t].etiqueta}
                  <span className="pano-paga">
                    {APUESTAS[t].paga}:1 · casa {APUESTAS[t].ventaja}%
                  </span>
                </button>
              ))}
            </div>

            <div className="pano-fila">
              <button
                type="button"
                className={`pano-opcion ${activa('triple')}`}
                onClick={() => elegir('triple')}
              >
                Cualquier triple
                <span className="pano-paga">30:1 · casa 13,89%</span>
              </button>
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`pano-opcion estrecha ${activa('tripleExacto', n)}`}
                  onClick={() => elegir('tripleExacto', n)}
                  title={`Triple de ${n}: paga 180:1, ventaja de la casa 16,2%`}
                >
                  {n}{n}{n}
                  <span className="pano-paga">180:1</span>
                </button>
              ))}
            </div>

            <div className="dados-totales">
              {TOTALES.map((t) => (
                <button
                  key={t.n}
                  type="button"
                  className={`pano-opcion estrecha ${activa('total', t.n)}`}
                  onClick={() => elegir('total', t.n)}
                  title={`Total ${t.n}: paga ${t.paga}:1, ventaja de la casa ${t.ventaja}%`}
                >
                  {t.n}
                  <span className="pano-paga">{t.paga}:1</span>
                </button>
              ))}
            </div>
          </div>

          <div className="apuesta-elegida dados-elegida">
            Apuestas a <strong>{etiqueta}</strong>
          </div>

          <Apuesta
            apuesta={apuesta}
            setApuesta={setApuesta}
            bloqueado={rodando || apuesta < APUESTA_MINIMA || apuesta > saldo}
            error={error}
            onJugar={jugar}
            texto={rodando ? 'Rodando…' : `Tirar por ${fichas(apuesta)}`}
          />
        </section>
      </div>
    </Sala>
  );
}
