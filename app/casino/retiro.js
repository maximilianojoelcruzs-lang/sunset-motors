'use client';

import { useState } from 'react';
import useSondeo from '../sondeo';
import Dialogo from '../dialogo';
import { RETIRO_MINIMO } from '../../lib/retiros-limites';

const fmt = new Intl.NumberFormat('es-CL');

const CUANDO = (iso) =>
  new Date(iso).toLocaleString('es-CL', {
    timeZone: 'America/Santiago',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

/**
 * Pedir el retiro de fichas. Las fichas **se descuentan al pedir**, no al entregar: si el
 * saldo siguiera ahí se podría pedir el retiro y seguir jugando esas mismas fichas, y el
 * administrador terminaría pagando algo que ya no existe.
 */
export default function Retiro({ saldo, onSaldo }) {
  const [abierto, setAbierto] = useState(false);
  const [fichas, setFichas] = useState(RETIRO_MINIMO);
  const [nota, setNota] = useState('');
  const [mias, setMias] = useState([]);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const cargar = async () => {
    try {
      const r = await fetch('/api/casino/retiros', { cache: 'no-store' });
      const cuerpo = await r.json().catch(() => ({}));
      if (r.ok) setMias(cuerpo.retiros ?? []);
    } catch {
      /* si falla, la lista simplemente no se refresca */
    }
  };

  // Mientras el diálogo está abierto se mira si el encargado ya resolvió.
  useSondeo(cargar, abierto ? 15000 : 0);

  const pendiente = mias.find((r) => r.estado === 'pendiente');

  const pedir = async () => {
    setError('');
    setAviso('');
    setOcupado(true);
    try {
      const r = await fetch('/api/casino/retiros', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fichas, nota }),
      });
      const cuerpo = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(cuerpo.error || 'No se pudo pedir.');
        return;
      }
      setAviso('Pedido. Un administrador te entrega el dinero en el juego.');
      setNota('');
      onSaldo?.(cuerpo.saldo);
      await cargar();
    } catch {
      setError('Sin conexión con el servidor.');
    } finally {
      setOcupado(false);
    }
  };

  const abrir = () => {
    setAbierto(true);
    setError('');
    setAviso('');
    setFichas(Math.min(Math.max(RETIRO_MINIMO, Math.floor(saldo / 500) * 500), saldo));
    cargar();
  };

  return (
    <>
      <button type="button" className="retiro-boton" onClick={abrir}>
        Retirar fichas
      </button>

      {abierto && (
        <Dialogo titulo="Retirar fichas" onCerrar={() => setAbierto(false)}>
          <p className="forma-pie">
            Pides retirar y las fichas se descuentan de inmediato. Un administrador recibe el
            aviso y te entrega el dinero dentro del juego. Si te lo rechaza, las fichas
            vuelven solas.
          </p>

          {error && <p className="panel-error">{error}</p>}
          {aviso && <p className="mecanicos-aviso">{aviso}</p>}

          {pendiente ? (
            <p className="panel-aviso">
              Ya tienes un retiro de <strong>{fmt.format(pendiente.fichas)}</strong> fichas
              esperando, pedido el {CUANDO(pendiente.pedido)}. Espera a que te lo resuelvan
              antes de pedir otro.
            </p>
          ) : (
            <>
              <label className="campo">
                <span>Cuántas fichas · tienes {fmt.format(saldo)}</span>
                <input
                  type="number"
                  step={500}
                  min={RETIRO_MINIMO}
                  max={saldo}
                  value={fichas}
                  onChange={(e) => setFichas(Math.max(0, Number(e.target.value) || 0))}
                />
              </label>

              <label className="campo">
                <span>Nota para el encargado (opcional)</span>
                <input
                  value={nota}
                  onChange={(e) => setNota(e.target.value)}
                  maxLength={200}
                  placeholder="Dónde te lo entrega, a qué hora…"
                />
              </label>
            </>
          )}

          {/* Cerrar va fuera del condicional: en cuanto se pide, la solicitud pasa a
              pendiente y el diálogo se quedaba sin ninguna salida a la vista. */}
          <div className="soli-botones">
            {!pendiente && (
              <button
                type="button"
                className="accion destacada"
                disabled={ocupado || fichas < RETIRO_MINIMO || fichas > saldo}
                onClick={pedir}
              >
                {ocupado ? 'Pidiendo…' : `Pedir ${fmt.format(fichas)} fichas`}
              </button>
            )}
            <button type="button" className="accion" onClick={() => setAbierto(false)}>
              Cerrar
            </button>
          </div>

          {mias.length > 0 && (
            <div className="retiro-lista">
              <h3 className="ref-titulo">Tus retiros</h3>
              <ul>
                {mias.slice(0, 8).map((r) => (
                  <li key={r.id}>
                    <span className={`retiro-estado ${r.estado}`}>{r.estado}</span>
                    <strong>{fmt.format(r.fichas)}</strong>
                    <em>{CUANDO(r.pedido)}</em>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Dialogo>
      )}
    </>
  );
}
