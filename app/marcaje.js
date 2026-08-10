'use client';

import { useEffect, useState } from 'react';
import { duracionMs, enHoras, soloHora } from '../lib/tiempo';

/**
 * Reloj del taller: marca entrada y salida, y mientras el turno esté abierto muestra
 * cuánto lleva la persona adentro.
 */
export default function Marcaje({ abiertoInicial }) {
  const [abierto, setAbierto] = useState(abiertoInicial);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const [ahora, setAhora] = useState(() => Date.now());

  // El contador solo corre si hay algo que contar.
  useEffect(() => {
    if (!abierto) return;
    const t = setInterval(() => setAhora(Date.now()), 30000);
    return () => clearInterval(t);
  }, [abierto]);

  const marcar = async (accion) => {
    setOcupado(true);
    setError('');
    try {
      const r = await fetch('/api/turnos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion }),
      });
      const cuerpo = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(cuerpo.error || 'No se pudo marcar.');
        return;
      }
      setAbierto(accion === 'entrada' ? cuerpo.turno : null);
      setAhora(Date.now());
    } catch {
      setError('Sin conexión con el servidor.');
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className={`marcaje ${abierto ? 'dentro' : ''}`}>
      <span className="marcaje-estado">
        {abierto ? (
          <>
            <span className="marcaje-punto" aria-hidden="true" />
            En turno desde las {soloHora(abierto.entrada)} ·{' '}
            <strong>{enHoras(duracionMs(abierto, ahora))}</strong>
          </>
        ) : (
          'Sin turno abierto'
        )}
      </span>

      {error && <span className="marcaje-error">{error}</span>}

      <button
        type="button"
        className="accion"
        onClick={() => marcar(abierto ? 'salida' : 'entrada')}
        disabled={ocupado}
      >
        {ocupado ? '…' : abierto ? 'Marcar salida' : 'Marcar entrada'}
      </button>
    </div>
  );
}
