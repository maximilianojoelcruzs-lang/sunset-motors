'use client';

import { useMemo, useRef, useState } from 'react';
import Sala, { fichas } from '../sala';
import Rueda, { anguloDe } from './rueda';
import Pano, { corto } from './pano';
import { APUESTA_MINIMA } from '../../../lib/fichas-limites';

const VALORES = [50, 100, 500, 1000, 5000];

export default function Mesa({ usuario, admin, saldoInicial }) {
  const [saldo, setSaldo] = useState(saldoInicial);
  const [ficha, setFicha] = useState(100);
  // Dónde está puesta cada ficha: { [sitio]: cuánto }. Es todo el estado de la apuesta.
  const [apuestas, setApuestas] = useState({});
  const [pila, setPila] = useState([]); // para deshacer, ficha a ficha
  const [anterior, setAnterior] = useState(null); // la última tirada, para repetirla

  const [angulo, setAngulo] = useState(0);
  const [girando, setGirando] = useState(false);
  const [ultima, setUltima] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [error, setError] = useState('');
  const vueltas = useRef(0);

  const total = useMemo(
    () => Object.values(apuestas).reduce((s, n) => s + n, 0),
    [apuestas]
  );
  const cuantas = Object.keys(apuestas).length;

  // Los sitios que pagaron, para encenderlos en el paño cuando para la rueda.
  const ganadores = useMemo(
    () => (ultima ? new Set(ultima.resultados.filter((r) => r.gano).map((r) => r.id)) : null),
    [ultima]
  );

  const poner = (id) => {
    if (girando) return;
    if (total + ficha > saldo) {
      setError('No te alcanzan las fichas para poner esa.');
      return;
    }
    setError('');
    setUltima(null);
    setApuestas((a) => ({ ...a, [id]: (a[id] ?? 0) + ficha }));
    setPila((p) => [...p, { id, monto: ficha }]);
  };

  const quitar = (id) => {
    if (girando || !apuestas[id]) return;
    setApuestas((a) => {
      const { [id]: _fuera, ...resto } = a;
      return resto;
    });
    setPila((p) => p.filter((f) => f.id !== id));
  };

  const deshacer = () => {
    if (girando || !pila.length) return;
    const ultimaFicha = pila[pila.length - 1];
    setPila((p) => p.slice(0, -1));
    setApuestas((a) => {
      const queda = (a[ultimaFicha.id] ?? 0) - ultimaFicha.monto;
      if (queda > 0) return { ...a, [ultimaFicha.id]: queda };
      const { [ultimaFicha.id]: _fuera, ...resto } = a;
      return resto;
    });
  };

  const limpiar = () => {
    if (girando) return;
    setApuestas({});
    setPila([]);
    setError('');
  };

  const repetir = () => {
    if (girando || !anterior) return;
    const suma = Object.values(anterior.apuestas).reduce((s, n) => s + n, 0);
    if (suma > saldo) {
      setError('No te alcanzan las fichas para repetir.');
      return;
    }
    setError('');
    setUltima(null);
    setApuestas(anterior.apuestas);
    setPila(anterior.pila);
  };

  const jugar = async () => {
    if (girando || !cuantas) return;
    setError('');
    setUltima(null);
    setGirando(true);

    try {
      const r = await fetch('/api/casino/ruleta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apuestas: Object.entries(apuestas).map(([id, monto]) => ({ id, monto })),
        }),
      });
      const cuerpo = await r.json().catch(() => ({}));

      if (!r.ok) {
        setError(cuerpo.error || 'No se pudo jugar.');
        setGirando(false);
        return;
      }

      // La rueda gira hasta el número que ya decidió el servidor. Se acumulan vueltas para
      // que cada tirada siga girando hacia adelante y no retroceda.
      vueltas.current += 5;
      setAngulo(anguloDe(cuerpo.numero, vueltas.current));
      setAnterior({ apuestas, pila });

      // Se espera a que pare la rueda antes de contar el resultado: decirlo antes arruina
      // la gracia. El saldo también, si no se ve el premio antes que el número.
      setTimeout(() => {
        setGirando(false);
        setUltima(cuerpo);
        setSaldo(cuerpo.saldo);
        setHistorial((h) => [cuerpo, ...h].slice(0, 14));
      }, 3100);
    } catch {
      setError('Sin conexión con el servidor.');
      setGirando(false);
    }
  };

  const detalle = ultima?.resultados.filter((r) => r.gano) ?? [];

  return (
    <Sala
      usuario={usuario}
      admin={admin}
      titulo="Ruleta"
      sub="Europea, un solo cero · ventaja de la casa 2,70% en todas las apuestas"
      saldo={saldo}
      aviso="El número lo sortea el servidor, no tu navegador. Los pagos son los de una ruleta
             europea real: la casa gana un 2,70% a la larga, en todas las apuestas por igual.
             Fichas de rol — no valen dinero ni se convierten en dinero."
    >
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
                  {detalle.length
                    ? `Acertaste ${detalle.map((r) => r.etiqueta).join(' y ')}`
                    : 'No fue esta vez'}
                </span>
                <span className="resultado-neto">
                  {ultima.neto >= 0 ? '+' : ''}
                  {fichas(ultima.neto)} fichas
                </span>
              </>
            ) : (
              <span className="resultado-texto">
                {cuantas
                  ? `${cuantas} ficha${cuantas > 1 ? 's' : ''} en el paño · ${fichas(total)}`
                  : 'Pon tus fichas en el paño'}
              </span>
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
          <Pano
            apuestas={apuestas}
            onPoner={poner}
            onQuitar={quitar}
            bloqueado={girando}
            ganadores={ganadores}
          />

          <div className="apuesta-caja">
            <div className="apuesta-elegida">
              {cuantas ? (
                <>
                  <strong>{fichas(total)}</strong> en {cuantas} sitio
                  {cuantas > 1 ? 's' : ''} del paño
                </>
              ) : (
                <>Elige una ficha y toca el paño</>
              )}
            </div>

            <div className="apuesta-fichas">
              {VALORES.map((v) => (
                <button
                  key={v}
                  type="button"
                  className={`ficha ${ficha === v ? 'activa' : ''}`}
                  disabled={girando}
                  onClick={() => setFicha(v)}
                >
                  {corto(v)}
                </button>
              ))}
              <input
                type="number"
                className="apuesta-otro"
                min={APUESTA_MINIMA}
                value={ficha}
                disabled={girando}
                onChange={(e) => setFicha(Math.max(0, Number(e.target.value) || 0))}
                aria-label="Otra cantidad por ficha"
              />
            </div>

            <div className="pano-mandos">
              <button type="button" onClick={deshacer} disabled={girando || !pila.length}>
                Deshacer
              </button>
              <button type="button" onClick={limpiar} disabled={girando || !cuantas}>
                Limpiar
              </button>
              <button type="button" onClick={repetir} disabled={girando || !anterior}>
                Repetir
              </button>
            </div>

            {error && <p className="apuesta-error">{error}</p>}

            <button
              type="button"
              className="apuesta-girar"
              onClick={jugar}
              disabled={girando || !cuantas || ficha < APUESTA_MINIMA || total > saldo}
            >
              {girando ? 'Girando…' : cuantas ? `Girar por ${fichas(total)}` : 'Pon una ficha'}
            </button>

            <p className="pano-ayuda">
              Toca un sitio para poner una ficha y otra vez para apilar. Con el botón derecho
              —o manteniendo pulsado— la quitas. Las fichas entre casillas son caballo, calle,
              cuadro y seisena, igual que en una mesa de verdad.
            </p>
          </div>
        </section>
      </div>
    </Sala>
  );
}
