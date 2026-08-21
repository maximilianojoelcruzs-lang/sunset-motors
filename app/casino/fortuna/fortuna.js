'use client';

import { useRef, useState } from 'react';
import Sala, { Apuesta, fichas } from '../sala';
import Rueda, { anguloDe } from './rueda';
import { TABLA, probabilidadDe, retornoTeorico } from '../../../lib/fortuna';
import { APUESTA_MINIMA } from '../../../lib/fichas-limites';

const RETORNO = (retornoTeorico() * 100).toFixed(2);
/** Lo que dura el giro en pantalla, igual que la transición del CSS. */
const GIRO = 3000;

export default function Fortuna({ usuario, admin, accesos, saldoInicial }) {
  const [saldo, setSaldo] = useState(saldoInicial);
  const [apuesta, setApuesta] = useState(100);
  const [angulo, setAngulo] = useState(0);
  const [girando, setGirando] = useState(false);
  const [ultima, setUltima] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [error, setError] = useState('');
  const vueltas = useRef(0);

  const jugar = async () => {
    if (girando) return;
    setError('');
    setUltima(null);
    setGirando(true);

    try {
      const r = await fetch('/api/casino/fortuna', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apuesta }),
      });
      const cuerpo = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(cuerpo.error || 'No se pudo girar.');
        setGirando(false);
        return;
      }

      // La rueda gira **hacia** el gajo que ya decidió el servidor. Se acumulan vueltas para
      // que cada tirada siga hacia adelante y no retroceda.
      vueltas.current += 5;
      setAngulo(anguloDe(cuerpo.gajo, vueltas.current));

      setTimeout(() => {
        setGirando(false);
        setUltima(cuerpo);
        setSaldo(cuerpo.saldo);
        setHistorial((h) => [cuerpo, ...h].slice(0, 14));
      }, GIRO + 100);
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
      titulo="Ruleta de la suerte"
      sub={`40 gajos · retorno al jugador ${RETORNO}%`}
      saldo={saldo}
      onSaldo={setSaldo}
      aviso="Acá no se elige dónde apostar: se gira y se cobra lo que marque el gajo. La ventaja
             de la casa son los gajos vacíos, no un pago recortado — cada gajo paga exactamente
             lo que dice. El gajo lo sortea el servidor. Fichas de rol — no valen dinero."
    >
      <div className="rasca-mesa">
        <section>
          <Rueda angulo={angulo} girando={girando} />

          <div className={`resultado ${ultima ? (ultima.gano ? 'gano' : 'perdio') : ''}`}>
            {girando ? (
              <span className="resultado-girando">Girando…</span>
            ) : ultima ? (
              ultima.multiplicador > 0 ? (
                <>
                  <span className="rasca-multi">x{ultima.multiplicador}</span>
                  <span className="resultado-texto">{fichas(ultima.premio)} fichas</span>
                  <span className="resultado-neto">
                    {ultima.neto >= 0 ? '+' : ''}
                    {fichas(ultima.neto)}
                  </span>
                </>
              ) : (
                <>
                  <span className="resultado-texto">Cayó en un gajo vacío</span>
                  <span className="resultado-neto">{fichas(ultima.neto)} fichas</span>
                </>
              )
            ) : (
              <span className="resultado-texto">Dale a la rueda</span>
            )}
          </div>

          {historial.length > 0 && (
            <div className="ruleta-historial">
              {historial.map((h, i) => (
                <span
                  key={i}
                  className="bolita"
                  style={{
                    background: TABLA.find((t) => t.multiplicador === h.multiplicador).color,
                    color: h.multiplicador === 0 ? '#9aa2cd' : '#0c0d16',
                  }}
                >
                  {h.multiplicador === 0 ? '—' : `x${h.multiplicador}`}
                </span>
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="rasca-tabla">
            <h2 className="casino-titulo">La rueda</h2>
            <ul>
              {TABLA.map((t) => (
                <li key={t.multiplicador}>
                  <span className="rasca-tres">
                    <span className="fortuna-muestra" style={{ background: t.color }} />
                    {t.multiplicador === 0 ? 'Vacío' : `Paga x${t.multiplicador}`}
                  </span>
                  <span className="rasca-paga">{t.cuantos} gajos</span>
                  <span className="rasca-prob">
                    {(probabilidadDe(t.multiplicador) * 100).toFixed(1)}%
                  </span>
                </li>
              ))}
            </ul>
            <p className="rasca-nota">
              Algo se llega a cobrar en algo más de la mitad de los giros, casi siempre el
              x0,8 —que devuelve casi lo apostado— o el x1,5. El x10 sale 1 de cada 40. La
              ventaja de la casa, {(100 - Number(RETORNO)).toFixed(2)}%, son los gajos vacíos.
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
