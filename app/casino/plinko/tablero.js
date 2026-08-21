'use client';

import { useEffect, useRef, useState } from 'react';
import Sala, { Apuesta, fichas } from '../sala';
import {
  CASILLAS,
  FILAS,
  PUÑADOS,
  TABLAS,
  probabilidadDe,
  retornoDe,
} from '../../../lib/plinko';
import { APUESTA_MINIMA } from '../../../lib/fichas-limites';

/** Medio hueco entre clavos, en % del ancho. De acá salen todas las posiciones. */
const PASO = 50 / CASILLAS;

/** Cuánto tarda la bolita en bajar un clavo, y cuánto se separan entre sí las del puñado. */
const CAIDA = 85;
const ENTRE_BOLITAS = 110;

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
  const [cuantas, setCuantas] = useState(1);
  // Una entrada por bolita en el aire: { i, derechas }. Se pintan todas a la vez.
  const [enElAire, setEnElAire] = useState([]);
  const [cayendo, setCayendo] = useState(false);
  const [ultima, setUltima] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [error, setError] = useState('');
  const relojes = useRef([]);

  // Si alguien se va de la mesa a mitad de caída, no dejamos temporizadores sueltos.
  useEffect(() => () => relojes.current.forEach(clearTimeout), []);

  const tabla = TABLAS[riesgo];
  const retorno = (retornoDe(riesgo) * 100).toFixed(2);
  const total = apuesta * cuantas;

  // Las casillas donde terminó cada bolita, para encenderlas al final.
  const acertadas = ultima ? ultima.tiradas.map((t) => t.casilla) : [];

  const jugar = async () => {
    if (cayendo) return;
    setError('');
    setUltima(null);
    setCayendo(true);
    setEnElAire([]);

    try {
      const r = await fetch('/api/casino/plinko', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apuesta, riesgo, bolitas: cuantas }),
      });
      const cuerpo = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(cuerpo.error || 'No se pudo jugar.');
        setCayendo(false);
        return;
      }

      // Cada bolita recorre el camino que ya vino decidido, saliendo escalonada. Acá no se
      // sortea nada: lo que se ve caer es el resultado, no el cálculo.
      relojes.current.forEach(clearTimeout);
      relojes.current = [];
      setEnElAire(cuerpo.tiradas.map(() => ({ i: 0, derechas: 0, visible: false })));

      cuerpo.tiradas.forEach((t, b) => {
        const salida = b * ENTRE_BOLITAS;
        relojes.current.push(
          setTimeout(() => {
            setEnElAire((a) => a.map((x, j) => (j === b ? { ...x, visible: true } : x)));
          }, salida)
        );

        t.camino.forEach((_, i) => {
          relojes.current.push(
            setTimeout(
              () => {
                const derechas = t.camino.slice(0, i + 1).reduce((s, p) => s + p, 0);
                setEnElAire((a) =>
                  a.map((x, j) => (j === b ? { i: i + 1, derechas, visible: true } : x))
                );
              },
              salida + (i + 1) * CAIDA
            )
          );
        });
      });

      const fin = (cuerpo.tiradas.length - 1) * ENTRE_BOLITAS + (FILAS + 1) * CAIDA;
      relojes.current.push(
        setTimeout(() => {
          setCayendo(false);
          setUltima(cuerpo);
          setSaldo(cuerpo.saldo);
          setHistorial((h) => [...cuerpo.tiradas.slice().reverse(), ...h].slice(0, 14));
        }, fin)
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
      onSaldo={setSaldo}
      aviso="Cada rebote es una moneda al aire que sortea el servidor, y por eso el centro se
             llena y las puntas casi nunca salen. Cada bolita es independiente de las demás.
             Elegir riesgo cambia cómo se gana, no cuánto. Fichas de rol — no valen dinero."
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

              {enElAire.map((b, i) => (
                <span
                  key={i}
                  className={`bolita-plinko ${b.visible ? 'viva' : ''}`}
                  style={{
                    left: `${equis(b.i, b.derechas)}%`,
                    top: `${(b.i / FILAS) * 100}%`,
                  }}
                  aria-hidden="true"
                />
              ))}
            </div>

            <div className="plinko-casillas">
              {tabla.pagos.map((m, k) => {
                const cuantasAhi = acertadas.filter((c) => c === k).length;
                return (
                  <span
                    key={k}
                    className={`casilla-plinko ${calor(m)} ${cuantasAhi ? 'acertada' : ''}`}
                    title={`1 de cada ${Math.round(1 / probabilidadDe(k)).toLocaleString('es-CL')}`}
                  >
                    x{m}
                    {cuantasAhi > 1 ? <em className="casilla-cuantas">{cuantasAhi}</em> : null}
                  </span>
                );
              })}
            </div>
          </div>

          <div className={`resultado ${ultima ? (ultima.gano ? 'gano' : 'perdio') : ''}`}>
            {cayendo ? (
              <span className="resultado-girando">Cayendo…</span>
            ) : ultima ? (
              <>
                <span className="rasca-multi">
                  x{(ultima.premio / ultima.apuestaTotal).toFixed(2)}
                </span>
                <span className="resultado-texto">
                  {ultima.bolitas === 1
                    ? `Casilla ${ultima.tiradas[0].casilla} · ${fichas(ultima.premio)} fichas`
                    : `${ultima.bolitas} bolitas · ${fichas(ultima.premio)} de ${fichas(ultima.apuestaTotal)}`}
                </span>
                <span className="resultado-neto">
                  {ultima.neto >= 0 ? '+' : ''}
                  {fichas(ultima.neto)}
                </span>
              </>
            ) : (
              <span className="resultado-texto">
                {cuantas === 1 ? 'Suelta la bolita' : `${cuantas} bolitas listas`}
              </span>
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

            <h2 className="casino-titulo plinko-titulo">Cuántas bolitas</h2>
            <div className="plinko-punados">
              {PUÑADOS.map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`plinko-punado ${cuantas === n ? 'activo' : ''}`}
                  disabled={cayendo}
                  onClick={() => setCuantas(n)}
                >
                  {n}
                </button>
              ))}
            </div>

            <p className="rasca-nota">
              Cada bolita cuesta la apuesta entera y cae por su cuenta: soltar diez no mejora
              nada, solo reparte lo mismo en diez tiros. Las tres tablas devuelven el mismo{' '}
              {retorno}%; en la alta la punta paga x{TABLAS.alto.pagos[0]} y sale 1 de cada
              4.096 bolitas.
            </p>
          </div>

          <Apuesta
            apuesta={apuesta}
            setApuesta={setApuesta}
            bloqueado={cayendo || apuesta < APUESTA_MINIMA || total > saldo}
            error={error}
            onJugar={jugar}
            texto={
              cayendo
                ? 'Cayendo…'
                : cuantas === 1
                  ? `Soltar por ${fichas(apuesta)}`
                  : `Soltar ${cuantas} por ${fichas(total)}`
            }
          />
        </section>
      </div>
    </Sala>
  );
}
