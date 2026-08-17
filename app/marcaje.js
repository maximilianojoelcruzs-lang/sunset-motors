'use client';

import { useEffect, useState } from 'react';
import { duracionMs, enHoras, soloHora } from '../lib/tiempo';
import { HORAS_MAXIMAS } from '../lib/turnos-limites';
import { marcarTurno } from './marcar';
import { BotonAvisos } from './aviso-escritorio';

/** Minutos que faltan para que el turno se cierre solo. */
export const restanMinutos = (turno, ahora) =>
  Math.max(0, Math.ceil((Date.parse(turno.entrada) + HORAS_MAXIMAS * 3600000 - ahora) / 60000));

/**
 * Reloj del taller sobre la calculadora. Es un componente controlado: el turno lo manda
 * quien lo usa, porque el menú de perfil muestra y cambia el mismo dato. Si guardara su
 * propia copia, marcar desde el menú lo dejaría mostrando algo falso.
 */
export default function Marcaje({ turno, onCambio }) {
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const [ahora, setAhora] = useState(() => Date.now());

  // Cada 30 s: suficiente para que el contador de minutos restantes no se vea congelado.
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

  const restan = turno ? restanMinutos(turno, ahora) : 0;
  const porTerminar = turno && restan <= 15;

  return (
    <div className={`marcaje ${turno ? 'dentro' : ''} ${porTerminar ? 'porTerminar' : ''}`}>
      <span className="marcaje-estado">
        {turno ? (
          <>
            <span className="marcaje-punto" aria-hidden="true" />
            En turno desde las {soloHora(turno.entrada)} ·{' '}
            <strong>{enHoras(duracionMs(turno, ahora))}</strong>
            <span className="marcaje-resta">
              {restan > 0
                ? `se cierra solo en ${restan} min`
                : 'se está cerrando solo…'}
            </span>
          </>
        ) : (
          'Sin turno abierto'
        )}
      </span>

      {error && <span className="marcaje-error">{error}</span>}

      {/* Cuando ya queda poco es cuando a alguien le importa que le avisen. */}
      {porTerminar && <BotonAvisos />}

      <button type="button" className="accion" onClick={marcar} disabled={ocupado}>
        {ocupado ? '…' : turno ? 'Marcar salida' : 'Marcar entrada'}
      </button>
    </div>
  );
}
