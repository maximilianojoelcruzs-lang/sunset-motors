'use client';

import { useEffect, useRef, useState } from 'react';
import Sala, { Apuesta, fichas } from '../sala';
import { RODILLO, retornoTeorico } from '../../../lib/tragamonedas';
import { APUESTA_MINIMA } from '../../../lib/fichas-limites';

const SIMBOLOS = RODILLO.map((r) => r.simbolo);
const RETORNO = (retornoTeorico() * 100).toFixed(1);

/**
 * Un rodillo. Mientras gira muestra símbolos al azar solo por efecto visual; cuando para,
 * muestra el que mandó el servidor. Lo que se ve girando no decide nada.
 *
 * **Cada rodillo sigue girando hasta su propio turno de parar.** Antes se congelaban los tres
 * de golpe cuando llegaba la respuesta —cada uno en el símbolo al azar que le tocó— y después
 * saltaban al bueno de a uno. Se veía como un tirón, no como una máquina.
 */
function Rodillo({ simbolo, girando, retraso }) {
  const [visible, setVisible] = useState(simbolo);
  const [quieto, setQuieto] = useState(true);
  // Al abrir la página los rodillos están parados: sin esto darían una vuelta sola.
  const arrancoAlgunaVez = useRef(false);

  useEffect(() => {
    if (!girando && !arrancoAlgunaVez.current) {
      setVisible(simbolo);
      return undefined;
    }

    const rodar = setInterval(() => {
      setVisible(SIMBOLOS[Math.floor(Math.random() * SIMBOLOS.length)]);
    }, 60);

    if (girando) {
      arrancoAlgunaVez.current = true;
      setQuieto(false);
      return () => clearInterval(rodar);
    }

    // Ya llegó el resultado: este rodillo gira lo suyo y recién ahí se planta.
    const alto = setTimeout(() => {
      clearInterval(rodar);
      setVisible(simbolo);
      setQuieto(true);
    }, retraso);

    return () => {
      clearInterval(rodar);
      clearTimeout(alto);
    };
  }, [girando, simbolo, retraso]);

  return (
    <div className={`rodillo ${quieto ? '' : 'girando'}`}>
      <span className="rodillo-simbolo">{visible}</span>
    </div>
  );
}

export default function Maquina({ usuario, admin, accesos, saldoInicial }) {
  const [saldo, setSaldo] = useState(saldoInicial);
  const [apuesta, setApuesta] = useState(100);
  const [simbolos, setSimbolos] = useState(['🍒', '🍋', '🔔']);
  const [girando, setGirando] = useState(false);
  const [ultima, setUltima] = useState(null);
  const [error, setError] = useState('');

  const jugar = async () => {
    if (girando) return;
    setError('');
    setUltima(null);
    setGirando(true);

    try {
      const r = await fetch('/api/casino/tragamonedas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apuesta }),
      });
      const cuerpo = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(cuerpo.error || 'No se pudo jugar.');
        setGirando(false);
        return;
      }

      setSimbolos(cuerpo.simbolos);
      setGirando(false);

      // El resultado se anuncia justo después de que se planta el último rodillo, ni antes
      // ni mucho después: el hueco entre una cosa y la otra es lo que se sentía raro.
      setTimeout(() => {
        setUltima(cuerpo);
        setSaldo(cuerpo.saldo);
      }, 2 * 220 + 160);
    } catch {
      setError('Sin conexión con el servidor.');
      setGirando(false);
    }
  };

  return (
    <Sala
      usuario={usuario}
      admin={admin}
      accesos={accesos}
      titulo="Tragamonedas"
      sub={`Tres rodillos, una línea · retorno al jugador ${RETORNO}%`}
      saldo={saldo}
      onSaldo={setSaldo}
      aviso="Los rodillos llevan pesos, como una máquina real: el 7 es raro porque hay pocos
             sietes en la cinta, no porque el programa haga trampa al final. Los símbolos los
             sortea el servidor. Fichas de rol — no valen dinero."
    >
      <div className="rasca-mesa">
        <section>
          <div className={`maquina ${ultima?.gano ? 'gano' : ''}`}>
            <div className="maquina-ventana">
              {simbolos.map((s, i) => (
                <Rodillo key={i} simbolo={s} girando={girando} retraso={i * 220} />
              ))}
            </div>
            <span className="maquina-linea" aria-hidden="true" />
          </div>

          <div className={`resultado ${ultima ? (ultima.gano ? 'gano' : 'perdio') : ''}`}>
            {girando ? (
              <span className="resultado-girando">Girando…</span>
            ) : ultima ? (
              ultima.gano ? (
                <>
                  <span className="rasca-multi">x{ultima.multiplicador}</span>
                  <span className="resultado-texto">
                    {ultima.linea} · ¡{fichas(ultima.premio)} fichas!
                  </span>
                  <span className="resultado-neto">
                    {ultima.neto >= 0 ? '+' : ''}
                    {fichas(ultima.neto)}
                  </span>
                </>
              ) : (
                <>
                  <span className="resultado-texto">Sin premio</span>
                  <span className="resultado-neto">{fichas(ultima.neto)} fichas</span>
                </>
              )
            ) : (
              <span className="resultado-texto">Tira de la palanca</span>
            )}
          </div>
        </section>

        <section>
          <div className="rasca-tabla">
            <h2 className="casino-titulo">Pagos</h2>
            <ul>
              {RODILLO.slice().reverse().map((r) => (
                <li key={r.simbolo}>
                  <span className="rasca-tres">
                    {r.simbolo}
                    {r.simbolo}
                    {r.simbolo}
                  </span>
                  <span className="rasca-paga">x{r.paga3}</span>
                  <span className="rasca-prob">
                    {(((r.peso / 100) ** 3) * 100).toFixed(3)}%
                  </span>
                </li>
              ))}
              <li>
                <span className="rasca-tres">🍒🍒 · dos exactas</span>
                <span className="rasca-paga">x1</span>
                <span className="rasca-prob">18,90%</span>
              </li>
            </ul>
            <p className="rasca-nota">
              Algo se gana en 1 de cada 4 giros, casi siempre las dos cerezas. El trío de 7
              sale 1 de cada 111.111: es el premio gordo y se comporta como tal.
            </p>
          </div>

          <Apuesta
            apuesta={apuesta}
            setApuesta={setApuesta}
            bloqueado={girando || apuesta < APUESTA_MINIMA || apuesta > saldo}
            error={error}
            onJugar={jugar}
            texto={girando ? 'Girando…' : `Girar por ${fichas(apuesta)}`}
          />
        </section>
      </div>
    </Sala>
  );
}
