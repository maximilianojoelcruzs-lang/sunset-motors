'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Sala, { Apuesta, fichas } from '../sala';
import { MINIMO, RETORNO, multiplicadorEn } from '../../../lib/aviator';
import { APUESTA_MINIMA } from '../../../lib/fichas-limites';

/** Cada cuánto se le pregunta al servidor si el avión sigue arriba. */
const LATIDO = 350;

/** La curva que dibuja el avión: sube despacio y después se dispara, como el multiplicador. */
function curva(avance) {
  const puntos = [];
  for (let i = 0; i <= 24; i += 1) {
    const t = (i / 24) * avance;
    puntos.push(`${t * 100},${100 - t * t * 100}`);
  }
  return puntos.join(' ');
}

export default function Vuelo({ usuario, admin, accesos, saldoInicial }) {
  const [saldo, setSaldo] = useState(saldoInicial);
  const [apuesta, setApuesta] = useState(100);
  const [auto, setAuto] = useState('');
  const [fase, setFase] = useState('quieto'); // quieto | volando | fin
  const [multiplicador, setMultiplicador] = useState(1);
  const [ultima, setUltima] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);

  // El reloj manda el servidor: acá solo se guarda la diferencia con el nuestro.
  const vuelo = useRef(null);
  const cuadro = useRef(null);
  const latido = useRef(null);

  const parar = () => {
    cancelAnimationFrame(cuadro.current);
    clearInterval(latido.current);
  };

  useEffect(() => parar, []);

  const aterrizar = useCallback((datos) => {
    parar();
    vuelo.current = null;
    setFase('fin');
    setMultiplicador(datos.multiplicador);
    setUltima(datos);
    setSaldo(datos.saldo);
    setHistorial((h) => [datos, ...h].slice(0, 14));
  }, []);

  const pedir = useCallback(
    async (accion, extra) => {
      const r = await fetch('/api/casino/aviator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion, ...extra }),
      });
      const datos = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(datos.error || 'No se pudo jugar.');
      return datos;
    },
    []
  );

  /** Arranca la animación y el latido para un vuelo que ya está en el aire. */
  const seguir = useCallback(
    (datos) => {
      vuelo.current = { inicio: datos.inicio, desfase: Date.now() - datos.servidor };
      setFase('volando');
      setUltima(null);

      const pintar = () => {
        if (!vuelo.current) return;
        const transcurrido = Date.now() - vuelo.current.desfase - vuelo.current.inicio;
        setMultiplicador(multiplicadorEn(transcurrido));
        cuadro.current = requestAnimationFrame(pintar);
      };
      cuadro.current = requestAnimationFrame(pintar);

      // El navegador no sabe dónde se cae el avión —ese es el juego—, así que pregunta.
      clearInterval(latido.current);
      latido.current = setInterval(async () => {
        try {
          const estado = await pedir('estado');
          if (estado.fase === 'fin') aterrizar(estado);
        } catch {
          /* un latido perdido no rompe nada: el siguiente lo resuelve */
        }
      }, LATIDO);
    },
    [pedir, aterrizar]
  );

  // Al entrar puede haber un vuelo a medias de otra pestaña o de antes de recargar.
  useEffect(() => {
    let vivo = true;
    pedir('estado')
      .then((estado) => {
        if (!vivo) return;
        if (estado.fase === 'volando') seguir(estado);
        else if (estado.fase === 'fin') aterrizar(estado);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [pedir, seguir, aterrizar]);

  const despegar = async () => {
    if (fase === 'volando' || ocupado) return;
    setError('');
    setOcupado(true);
    try {
      const datos = await pedir('despegar', { apuesta, auto: auto === '' ? null : auto });
      if (datos.fase === 'fin') aterrizar(datos);
      else seguir(datos);
    } catch (e) {
      setError(e.message);
    } finally {
      setOcupado(false);
    }
  };

  const retirar = async () => {
    if (fase !== 'volando' || ocupado) return;
    setOcupado(true);
    try {
      aterrizar(await pedir('retirar'));
    } catch (e) {
      setError(e.message);
    } finally {
      setOcupado(false);
    }
  };

  const volando = fase === 'volando';
  const cayo = fase === 'fin' && !ultima?.gano;
  // El cielo se aleja a medida que el avión sube, como en las mesas de verdad: si la escala
  // fuera fija, el 95% de los vuelos se quedaría amontonado en la esquina de abajo.
  const avance = Math.min(
    0.97,
    Math.log(Math.max(1.02, multiplicador)) / Math.log(Math.max(2, multiplicador * 1.6))
  );

  return (
    <Sala
      usuario={usuario}
      admin={admin}
      accesos={accesos}
      titulo="Aviator"
      sub={`Retírate antes de que se caiga · retorno al jugador ${Math.round(RETORNO * 100)}%`}
      saldo={saldo}
      aviso="Dónde se cae el avión se sortea antes de despegar y no sale del servidor hasta que
             terminas. Retirarse temprano o tarde da exactamente el mismo retorno: lo único que
             cambia es cada cuánto ganas. Fichas de rol — no valen dinero."
    >
      <div className="rasca-mesa">
        <section>
          <div className={`aviator ${volando ? 'volando' : ''} ${cayo ? 'cayo' : ''}`}>
            <svg className="aviator-cielo" viewBox="0 0 100 100" preserveAspectRatio="none">
              <polyline className="aviator-estela" points={curva(avance)} />
            </svg>

            <span
              className="aviator-avion"
              style={{ left: `${avance * 100}%`, bottom: `${avance * avance * 100}%` }}
              aria-hidden="true"
            >
              {cayo ? '💥' : '✈️'}
            </span>

            <span className={`aviator-cifra ${cayo ? 'roto' : ''}`}>
              x{multiplicador.toFixed(2)}
            </span>

            {fase === 'quieto' && <span className="aviator-listo">Listo para despegar</span>}
          </div>

          <div className={`resultado ${fase === 'fin' ? (ultima.gano ? 'gano' : 'perdio') : ''}`}>
            {volando ? (
              <>
                <span className="resultado-texto">En el aire</span>
                <span className="resultado-neto">
                  Vale {fichas(Math.round(apuesta * multiplicador))} fichas ahora mismo
                </span>
              </>
            ) : fase === 'fin' ? (
              <>
                <span className="resultado-texto">
                  {ultima.gano
                    ? `Te bajaste en x${ultima.multiplicador}${ultima.automatico ? ' (automático)' : ''} · se cayó en x${ultima.choque}`
                    : `Se cayó en x${ultima.choque}`}
                </span>
                <span className="resultado-neto">
                  {ultima.neto >= 0 ? '+' : ''}
                  {fichas(ultima.neto)} fichas
                </span>
              </>
            ) : (
              <span className="resultado-texto">Pon tu apuesta y despega</span>
            )}
          </div>

          {historial.length > 0 && (
            <div className="ruleta-historial">
              {historial.map((h, i) => (
                <span
                  key={i}
                  className={`bolita ${h.choque >= 10 ? 'ardiente' : h.choque >= 2 ? 'buena' : 'fria'}`}
                >
                  x{h.choque}
                </span>
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="rasca-tabla">
            <h2 className="casino-titulo">Cuánto aguanta</h2>
            <ul>
              {[1.2, 1.5, 2, 3, 5, 10, 50].map((m) => (
                <li key={m}>
                  <span className="rasca-tres">Te bajas en x{m}</span>
                  <span className="rasca-paga">{fichas(Math.round(apuesta * m))}</span>
                  <span className="rasca-prob">{((RETORNO / m) * 100).toFixed(1)}%</span>
                </li>
              ))}
            </ul>
            <p className="rasca-nota">
              La columna de la derecha es cada cuánto llega el avión hasta ahí. Retirarse en
              1,50 acierta 2 de cada 3 veces y paga poco; en 10 acierta 1 de cada 10 y paga
              mucho. Los dos devuelven el mismo {Math.round(RETORNO * 100)}%: no hay estrategia
              que mueva el margen, solo cambia cada cuánto ganas.
            </p>
          </div>

          {volando ? (
            <div className="apuesta-caja">
              <p className="poker-apostado">
                Apostaste <strong>{fichas(apuesta)}</strong>
                {auto ? ` · se baja solo en x${auto}` : ''}
              </p>
              {error && <p className="apuesta-error">{error}</p>}
              <button
                type="button"
                className="apuesta-girar retirar"
                onClick={retirar}
                disabled={ocupado || multiplicador < MINIMO}
              >
                Retirar {fichas(Math.round(apuesta * multiplicador))}
              </button>
            </div>
          ) : (
            <>
              <label className="campo-inline aviator-auto">
                <span>Retiro automático</span>
                <input
                  type="number"
                  step="0.01"
                  min={MINIMO}
                  value={auto}
                  placeholder="sin automático"
                  onChange={(e) => setAuto(e.target.value)}
                />
              </label>

              <Apuesta
                apuesta={apuesta}
                setApuesta={setApuesta}
                minimo={APUESTA_MINIMA}
                bloqueado={ocupado || apuesta < APUESTA_MINIMA || apuesta > saldo}
                error={error}
                onJugar={despegar}
                texto={ocupado ? 'Despegando…' : `Despegar por ${fichas(apuesta)}`}
              />
            </>
          )}
        </section>
      </div>
    </Sala>
  );
}
