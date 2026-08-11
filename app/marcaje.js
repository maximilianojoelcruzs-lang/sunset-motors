'use client';

import { useEffect, useState } from 'react';
import { duracionMs, enHoras, soloHora } from '../lib/tiempo';
import { marcarTurno } from './marcar';

/**
 * Reloj del taller sobre la calculadora. Es un componente controlado: el turno lo manda
 * quien lo usa, porque el menú de perfil muestra y cambia el mismo dato. Si guardara su
 * propia copia, marcar desde el menú lo dejaría mostrando algo falso.
 */
export default function Marcaje({ turno, onCambio }) {
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const [ahora, setAhora] = useState(() => Date.now());

  // El contador solo corre si hay algo que contar.
  useEffect(() => {
    if (!turno) return;
    const t = setInterval(() => setAhora(Date.now()), 30000);
    return () => clearInterval(t);
  }, [turno]);

  const marcar = async () => {
    setOcupado(true);
    setError('');
    const { turno: nuevo, error: fallo } = await marcarTurno(turno ? 'salida' : 'entrada');
    if (fallo) setError(fallo);
    else {
      onCambio(nuevo);
      setAhora(Date.now());
    }
    setOcupado(false);
  };

  return (
    <div className={`marcaje ${turno ? 'dentro' : ''}`}>
      <span className="marcaje-estado">
        {turno ? (
          <>
            <span className="marcaje-punto" aria-hidden="true" />
            En turno desde las {soloHora(turno.entrada)} ·{' '}
            <strong>{enHoras(duracionMs(turno, ahora))}</strong>
          </>
        ) : (
          'Sin turno abierto'
        )}
      </span>

      {error && <span className="marcaje-error">{error}</span>}

      <button type="button" className="accion" onClick={marcar} disabled={ocupado}>
        {ocupado ? '…' : turno ? 'Marcar salida' : 'Marcar entrada'}
      </button>
    </div>
  );
}
