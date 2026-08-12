'use client';

import { useEffect, useState } from 'react';
import Sala, { Apuesta, fichas } from '../sala';
import { PREMIOS } from '../../../lib/rasca';
import { APUESTA_MINIMA } from '../../../lib/fichas-limites';

/** La tabla de premios, del mejor al peor. El símbolo sale del propio premio. */
const TABLA = PREMIOS.filter((p) => p.multiplicador > 0)
  .slice()
  .reverse()
  .map((p) => ({ ...p, probabilidad: (p.peso / 10000) * 100 }));

export default function Carton({ usuario, admin, saldoInicial }) {
  const [saldo, setSaldo] = useState(saldoInicial);
  const [apuesta, setApuesta] = useState(100);
  const [carton, setCarton] = useState(null);
  const [destapadas, setDestapadas] = useState([]);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState('');
  const [comprando, setComprando] = useState(false);

  const todasDestapadas = carton && destapadas.length === 9;

  // El premio se anuncia recién cuando el cartón está entero destapado: contarlo antes
  // arruinaría el raspado. El resultado ya estaba decidido desde que se compró.
  useEffect(() => {
    if (todasDestapadas && carton) setResultado(carton);
  }, [todasDestapadas, carton]);

  const comprar = async () => {
    setError('');
    setResultado(null);
    setDestapadas([]);
    setCarton(null);
    setComprando(true);

    try {
      const r = await fetch('/api/casino/rasca', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apuesta }),
      });
      const cuerpo = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(cuerpo.error || 'No se pudo comprar.');
        return;
      }
      setCarton(cuerpo);
      setSaldo(cuerpo.saldo);
    } catch {
      setError('Sin conexión con el servidor.');
    } finally {
      setComprando(false);
    }
  };

  const destapar = (i) =>
    setDestapadas((d) => (d.includes(i) ? d : [...d, i]));

  return (
    <Sala
      usuario={usuario}
      admin={admin}
      titulo="Rasca y gana"
      sub="Tres símbolos iguales · retorno al jugador 92%"
      saldo={saldo}
      aviso="El cartón viene resuelto del servidor desde que lo compras: raspar rápido o lento
             no cambia nada, igual que un raspadito de papel. Fichas de rol — no valen dinero."
    >
      <div className="rasca-mesa">
        <section>
          <div className={`rasca-carton ${resultado?.gano ? 'gano' : ''}`}>
            {(carton?.carton ?? new Array(9).fill(null)).map((simbolo, i) => (
              <button
                key={i}
                type="button"
                className={`rasca-casilla ${destapadas.includes(i) ? 'abierta' : ''}`}
                disabled={!carton || destapadas.includes(i)}
                onClick={() => destapar(i)}
                aria-label={destapadas.includes(i) ? simbolo : `Raspar casilla ${i + 1}`}
              >
                <span className="rasca-simbolo">{destapadas.includes(i) ? simbolo : '?'}</span>
              </button>
            ))}
          </div>

          {carton && !todasDestapadas && (
            <button
              type="button"
              className="rasca-todo"
              onClick={() => setDestapadas([0, 1, 2, 3, 4, 5, 6, 7, 8])}
            >
              Raspar todo
            </button>
          )}

          <div className={`resultado ${resultado ? (resultado.gano ? 'gano' : 'perdio') : ''}`}>
            {!carton ? (
              <span className="resultado-texto">Compra un cartón para empezar</span>
            ) : !todasDestapadas ? (
              <span className="resultado-girando">
                Raspa las {9 - destapadas.length} que faltan…
              </span>
            ) : resultado?.gano ? (
              <>
                <span className="rasca-multi">x{resultado.multiplicador}</span>
                <span className="resultado-texto">¡Ganaste {fichas(resultado.premio)}!</span>
                <span className="resultado-neto">
                  {resultado.neto >= 0 ? '+' : ''}
                  {fichas(resultado.neto)} fichas
                </span>
              </>
            ) : (
              <>
                <span className="resultado-texto">Sin premio esta vez</span>
                <span className="resultado-neto">{fichas(resultado?.neto ?? 0)} fichas</span>
              </>
            )}
          </div>
        </section>

        <section>
          <div className="rasca-tabla">
            <h2 className="casino-titulo">Premios</h2>
            <ul>
              {TABLA.map((p) => (
                <li key={p.multiplicador}>
                  <span className="rasca-tres">
                    {p.simbolo}
                    {p.simbolo}
                    {p.simbolo}
                  </span>
                  <span className="rasca-paga">x{p.multiplicador}</span>
                  <span className="rasca-prob">{p.probabilidad.toFixed(2)}%</span>
                </li>
              ))}
            </ul>
            <p className="rasca-nota">
              62,75% de los cartones no llevan premio. A la larga se recupera el 92% de lo
              apostado: la casa se queda con el 8%.
            </p>
          </div>

          <Apuesta
            apuesta={apuesta}
            setApuesta={setApuesta}
            minimo={APUESTA_MINIMA}
            bloqueado={comprando || apuesta < APUESTA_MINIMA || apuesta > saldo}
            error={error}
            onJugar={comprar}
            texto={comprando ? 'Comprando…' : `Comprar cartón por ${fichas(apuesta)}`}
          />
        </section>
      </div>
    </Sala>
  );
}
