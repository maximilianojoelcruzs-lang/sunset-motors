'use client';

import { useCallback, useEffect, useState } from 'react';
import Sala, { fichas } from '../sala';
import useSondeo from '../../sondeo';
import {
  LETRAS,
  MAX_CARTONES,
  PARTE_BINGO,
  PARTE_LINEA,
  RETORNO,
  columnaDe,
  tieneBingo,
  tieneLinea,
} from '../../../lib/bingo';

/** Cada cuánto se le pregunta al servidor por bolas nuevas. */
const LATIDO = 3000;

/** Un cartón, con lo que ya salió marcado. */
function Carton({ carton, cantadas, mio }) {
  const set = new Set(cantadas);
  const linea = tieneLinea(carton.numeros, set);
  const bingo = tieneBingo(carton.numeros, set);

  return (
    <div className={`carton ${mio ? 'mio' : ''} ${bingo ? 'bingo' : linea ? 'linea' : ''}`}>
      <span className="carton-dueno">
        {carton.usuario}
        {bingo ? ' · ¡bingo!' : linea ? ' · línea' : ''}
      </span>
      <div className="carton-rejilla">
        {LETRAS.map((l) => (
          <span key={l} className="carton-letra">
            {l}
          </span>
        ))}
        {Array.from({ length: 5 }, (_, f) =>
          carton.numeros.map((columna, c) => {
            const n = columna[f];
            return (
              <span
                key={`${c}-${f}`}
                className={`carton-casilla ${n === null ? 'libre' : set.has(n) ? 'marcada' : ''}`}
              >
                {n === null ? '★' : n}
              </span>
            );
          })
        )}
      </div>
    </div>
  );
}

export default function Bingo({ usuario, admin, accesos, saldoInicial }) {
  const [saldo, setSaldo] = useState(saldoInicial);
  const [ronda, setRonda] = useState(null);
  const [cuantos, setCuantos] = useState(1);
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [ahora, setAhora] = useState(() => Date.now());

  const cargar = useCallback(async () => {
    try {
      const r = await fetch('/api/casino/bingo', { cache: 'no-store' });
      const datos = await r.json().catch(() => ({}));
      if (!r.ok) return;
      setRonda(datos);
      setSaldo(datos.saldo);
    } catch {
      /* un latido perdido no rompe nada: el siguiente lo arregla */
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Mientras hay ronda se pregunta seguido; sin ronda, de vez en cuando.
  useSondeo(cargar, ronda?.fase === 'sin-ronda' ? 10000 : LATIDO);

  // Un reloj propio para la cuenta atrás de la venta, que se mueve entre latido y latido.
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 200);
    return () => clearInterval(t);
  }, []);

  const comprar = async () => {
    setError('');
    setOcupado(true);
    try {
      const r = await fetch('/api/casino/bingo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cartones: cuantos }),
      });
      const datos = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(datos.error || 'No se pudo comprar.');
        await cargar();
        return;
      }
      setRonda(datos);
      setSaldo(datos.saldo);
    } catch {
      setError('Sin conexión con el servidor.');
    } finally {
      setOcupado(false);
    }
  };

  // Las bolas salen de a una en pantalla, con el reloj del servidor.
  //
  // El servidor manda solo las ya cantadas —nunca las que vienen— y acá se van revelando al
  // ritmo que corresponde. Sin esto, con un latido cada 3 segundos y una bola cada 800 ms,
  // aparecerían de a cuatro de golpe en vez de cantarse.
  const desfase = ronda?.servidor ? ahora - ronda.servidor : 0;
  const alRitmo =
    ronda?.fase === 'cantando' && ronda.cierraVenta
      ? Math.floor((ahora - desfase - Date.parse(ronda.cierraVenta)) / ronda.ritmo) + 1
      : Infinity;

  const bolas = (ronda?.bolas ?? []).slice(0, Math.max(0, Math.min(ronda?.bolas?.length ?? 0, alRitmo)));
  const ultima = bolas[bolas.length - 1] ?? null;
  const mios = (ronda?.cartones ?? []).filter((c) => c.mio);
  const vendiendo = ronda?.fase === 'vendiendo';
  const cantando = ronda?.fase === 'cantando';

  const faltan = vendiendo
    ? Math.max(0, Math.ceil((Date.parse(ronda.cierraVenta) - ahora) / 1000))
    : 0;

  const precio = ronda?.precio ?? 500;
  const bote = Math.round((ronda?.cartones?.length ?? 0) * precio * RETORNO);
  const ultimaRonda = ronda?.historial?.[0];

  return (
    <Sala
      usuario={usuario}
      admin={admin}
      accesos={accesos}
      titulo="Bingo"
      sub={`75 bolas · el cartón vale ${fichas(precio)} · se juega entre todos`}
      saldo={saldo}
      aviso="Es la única mesa donde no se juega contra la casa: el bote son los cartones
             vendidos y se lo reparten los que canten. La casa se queda el 5%. El orden de las
             bolas se sortea al abrir la ronda y no sale del servidor hasta que se cantan."
    >
      <div className="bingo-mesa">
        <section>
          <div className={`bingo-bombo ${cantando ? 'cantando' : ''}`}>
            {ultima ? (
              <>
                <span className="bola-grande">
                  <em>{LETRAS[columnaDe(ultima)]}</em>
                  {ultima}
                </span>
                <span className="bingo-cuenta">{bolas.length} de 75</span>
              </>
            ) : vendiendo ? (
              <>
                <span className="bingo-espera">{faltan}</span>
                <span className="bingo-cuenta">
                  segundos para comprar · {ronda.cartones.length} cartones en juego
                </span>
              </>
            ) : (
              <span className="bingo-cuenta">
                {ronda?.fase === 'sin-ronda'
                  ? 'No hay ronda. Compra un cartón y se abre una.'
                  : 'Cargando…'}
              </span>
            )}
          </div>

          {bolas.length > 0 && (
            <div className="bingo-cantadas">
              {bolas
                .slice()
                .reverse()
                .map((b, i) => (
                  <span key={b} className={`bola-chica ${i === 0 ? 'nueva' : ''}`}>
                    {b}
                  </span>
                ))}
            </div>
          )}

          {mios.length > 0 ? (
            <div className="cartones">
              {mios.map((c) => (
                <Carton key={c.id} carton={c} cantadas={bolas} mio />
              ))}
            </div>
          ) : (
            <p className="vacio">
              {vendiendo
                ? 'Todavía no tienes cartones en esta ronda.'
                : 'Compra cartones cuando se abra la próxima ronda.'}
            </p>
          )}
        </section>

        <section>
          <div className="apuesta-caja">
            <div className="apuesta-elegida">
              {ronda?.cartones?.length ? (
                <>
                  Bote de <strong>{fichas(bote)}</strong> · {ronda.cartones.length} cartones
                </>
              ) : (
                <>El bote se arma con los cartones vendidos</>
              )}
            </div>

            <div className="apuesta-fichas">
              {Array.from({ length: MAX_CARTONES }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`ficha ${cuantos === n ? 'activa' : ''}`}
                  disabled={ocupado || cantando}
                  onClick={() => setCuantos(n)}
                >
                  {n}
                </button>
              ))}
              <output className="apuesta-otro" aria-label="Coste">
                {fichas(cuantos * precio)}
              </output>
            </div>

            {error && <p className="apuesta-error">{error}</p>}

            <button
              type="button"
              className="apuesta-girar"
              onClick={comprar}
              disabled={ocupado || cantando || cuantos * precio > saldo}
            >
              {cantando
                ? 'Ronda en marcha…'
                : ocupado
                  ? 'Comprando…'
                  : `Comprar ${cuantos} por ${fichas(cuantos * precio)}`}
            </button>

            <p className="pano-ayuda">
              {vendiendo
                ? `Quedan ${faltan} s de venta. Al terminar empiezan a salir bolas cada 2 segundos.`
                : cantando
                  ? `Ronda en marcha, bola ${bolas.length} de 75. La siguiente se abre en cuanto alguien compre un cartón.`
                  : 'La primera compra abre la ronda y arranca la cuenta atrás de 45 segundos.'}
            </p>
          </div>

          <div className="rasca-tabla">
            <h2 className="casino-titulo">Cómo se reparte</h2>
            <ul>
              <li>
                <span className="rasca-tres">Línea (una fila)</span>
                <span className="rasca-paga">{PARTE_LINEA * 100}%</span>
                <span className="rasca-prob">del bote</span>
              </li>
              <li>
                <span className="rasca-tres">Bingo (cartón entero)</span>
                <span className="rasca-paga">{PARTE_BINGO * 100}%</span>
                <span className="rasca-prob">del bote</span>
              </li>
              <li>
                <span className="rasca-tres">La casa</span>
                <span className="rasca-paga">{Math.round((1 - RETORNO) * 100)}%</span>
                <span className="rasca-prob">comisión</span>
              </li>
            </ul>
            <p className="rasca-nota">
              Si cantan varios a la vez, se reparte en partes iguales. La casa no juega: no
              pone cartones ni gana por acertar, solo se queda su comisión. Acá lo que gana
              uno lo ponen los demás.
            </p>
          </div>

          {ultimaRonda?.resultado && (
            <div className="rasca-tabla">
              <h2 className="casino-titulo">Ronda anterior</h2>
              <ul>
                <li>
                  <span className="rasca-tres">Bingo en la bola</span>
                  <span className="rasca-paga">{ultimaRonda.resultado.bingo + 1}</span>
                </li>
                {ultimaRonda.resultado.premios.map((p) => (
                  <li key={p.usuario}>
                    <span className="rasca-tres">{p.usuario}</span>
                    <span className="rasca-paga">{fichas(p.cuanto)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </Sala>
  );
}
