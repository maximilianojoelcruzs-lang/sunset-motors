'use client';

import { useState } from 'react';
import Sala, { Apuesta, fichas } from '../sala';
import { Cara, nombreCarta } from '../carta';
import { MANOS, cartasQuePagan, esRoja, evaluar } from '../../../lib/poker';
import { APUESTA_MINIMA } from '../../../lib/fichas-limites';

/** Una carta. Boca abajo mientras no hay reparto; marcada = la persona se la queda. */
function Carta({ carta, marcada, nueva, paga, onClick, activa }) {
  if (!carta) {
    return (
      <div className="carta dorso" aria-hidden="true">
        <span />
      </div>
    );
  }

  return (
    <button
      type="button"
      className={`carta ${esRoja(carta) ? 'roja' : ''} ${marcada ? 'marcada' : ''} ${
        nueva ? 'nueva' : ''
      } ${paga ? 'paga' : ''}`}
      onClick={onClick}
      disabled={!activa}
      aria-pressed={marcada}
      aria-label={`${nombreCarta(carta)}${marcada ? ', te la quedas' : ''}`}
    >
      <Cara carta={carta} />
      <span className="carta-sello">{marcada ? 'ME LA QUEDO' : paga ? 'PAGA' : ''}</span>
    </button>
  );
}

export default function Mesa({ usuario, admin, accesos, saldoInicial, pendiente }) {
  const [saldo, setSaldo] = useState(saldoInicial);
  const [apuesta, setApuesta] = useState(pendiente?.apuesta ?? 100);
  const [mano, setMano] = useState(pendiente?.mano ?? [null, null, null, null, null]);
  const [quedan, setQuedan] = useState([]);
  const [fase, setFase] = useState(pendiente ? 'eligiendo' : 'apuesta');
  const [ultima, setUltima] = useState(null);
  const [cambiadas, setCambiadas] = useState([]);
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const eligiendo = fase === 'eligiendo';
  // Lo que vale la mano en este momento, calculado acá solo para mostrarlo: el premio lo
  // decide el servidor cuando llega el cambio.
  const parcial = eligiendo ? evaluar(mano) : null;
  const pagan = fase === 'resultado' && ultima.gano ? cartasQuePagan(mano, ultima.resultado) : [];

  const pedir = async (accion, cuerpo) => {
    setError('');
    setOcupado(true);
    try {
      const r = await fetch('/api/casino/poker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion, ...cuerpo }),
      });
      const datos = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(datos.error || 'No se pudo jugar.');
        return null;
      }
      return datos;
    } catch {
      setError('Sin conexión con el servidor.');
      return null;
    } finally {
      setOcupado(false);
    }
  };

  const repartir = async () => {
    // La fase vuelve atrás junto con el resultado, no después: dejarla en 'resultado' con
    // `ultima` ya en null es un estado que no existe, y la pantalla se cae al pintarlo.
    setFase('apuesta');
    setUltima(null);
    setCambiadas([]);
    setQuedan([]);
    const datos = await pedir('repartir', { apuesta });
    if (!datos) return;
    setMano(datos.mano);
    setApuesta(datos.apuesta);
    setSaldo(datos.saldo);
    setFase('eligiendo');
  };

  const cambiar = async () => {
    const datos = await pedir('cambiar', { seQueda: quedan });
    if (!datos) return;
    setMano(datos.mano);
    setCambiadas(datos.cambiadas);
    setSaldo(datos.saldo);
    setUltima(datos);
    setFase('resultado');
  };

  const marcar = (i) =>
    setQuedan((q) => (q.includes(i) ? q.filter((x) => x !== i) : [...q, i]));

  const aCambiar = 5 - quedan.length;

  return (
    <Sala
      usuario={usuario}
      admin={admin}
      accesos={accesos}
      titulo="Vídeo póker"
      sub="Jacks or Better · tabla 9/6 · hasta 99,5% de retorno con juego perfecto"
      saldo={saldo}
      onSaldo={setSaldo}
      aviso="Se reparten cinco cartas, tú eliges cuáles te quedas y las demás se cambian. El
             mazo se baraja entero en el servidor antes de que elijas, así que las cartas que
             vienen ya estaban decididas. Fichas de rol — no valen dinero."
    >
      <div className="poker-mesa">
        <section>
          <div className={`cartas ${ultima?.gano ? 'gano' : ''}`}>
            {mano.map((c, i) => (
              <Carta
                key={i}
                carta={c}
                marcada={eligiendo && quedan.includes(i)}
                nueva={fase === 'resultado' && cambiadas.includes(i)}
                paga={pagan.includes(i)}
                activa={eligiendo && !ocupado}
                onClick={() => marcar(i)}
              />
            ))}
          </div>

          <div
            className={`resultado ${
              fase === 'resultado' ? (ultima.gano ? 'gano' : 'perdio') : ''
            }`}
          >
            {eligiendo ? (
              <>
                <span className="resultado-texto">
                  {parcial.paga ? `Ahora tienes ${parcial.nombre}` : 'Todavía no hay premio'}
                </span>
                <span className="resultado-neto">
                  Toca las cartas que te quedas · cambias {aCambiar}
                </span>
              </>
            ) : fase === 'resultado' ? (
              ultima.gano ? (
                <>
                  <span className="rasca-multi">x{ultima.resultado.paga}</span>
                  <span className="resultado-texto">
                    {ultima.resultado.nombre} · {fichas(ultima.premio)} fichas
                  </span>
                  <span className="resultado-neto">
                    {ultima.neto >= 0 ? '+' : ''}
                    {fichas(ultima.neto)}
                  </span>
                </>
              ) : (
                <>
                  <span className="resultado-texto">{ultima.resultado.nombre}</span>
                  <span className="resultado-neto">{fichas(ultima.neto)} fichas</span>
                </>
              )
            ) : (
              <span className="resultado-texto">Pon tu apuesta y pide cartas</span>
            )}
          </div>
        </section>

        <section>
          <div className="rasca-tabla">
            <h2 className="casino-titulo">Pagos</h2>
            <ul>
              {MANOS.map((m) => (
                <li
                  key={m.clave}
                  className={
                    fase === 'resultado' && ultima.resultado.clave === m.clave
                      ? 'premiada'
                      : eligiendo && parcial.clave === m.clave
                        ? 'apuntada'
                        : ''
                  }
                >
                  <span className="rasca-tres">{m.nombre}</span>
                  <span className="rasca-paga">x{m.paga}</span>
                </li>
              ))}
            </ul>
            <p className="rasca-nota">
              La pareja de J o mejor paga x1: te devuelve la apuesta, ni ganas ni pierdes. El
              9 del full y el 6 del color son los pagos completos — las máquinas de verdad los
              recortan a 8/5 o 7/5 y ahí se les cae el retorno.
            </p>
          </div>

          {eligiendo ? (
            <div className="apuesta-caja">
              <p className="poker-apostado">
                Apostaste <strong>{fichas(apuesta)}</strong> fichas
              </p>
              {error && <p className="apuesta-error">{error}</p>}
              <button
                type="button"
                className="apuesta-girar"
                onClick={cambiar}
                disabled={ocupado}
              >
                {ocupado
                  ? 'Repartiendo…'
                  : aCambiar === 0
                    ? 'Me quedo con estas'
                    : `Cambiar ${aCambiar}`}
              </button>
            </div>
          ) : (
            <Apuesta
              apuesta={apuesta}
              setApuesta={setApuesta}
              bloqueado={ocupado || apuesta < APUESTA_MINIMA || apuesta > saldo}
              error={error}
              onJugar={repartir}
              texto={ocupado ? 'Repartiendo…' : `Pedir cartas por ${fichas(apuesta)}`}
            />
          )}
        </section>
      </div>
    </Sala>
  );
}
