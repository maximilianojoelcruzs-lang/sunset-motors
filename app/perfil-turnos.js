'use client';

import { useEffect, useMemo, useState } from 'react';
import { diaCorto, duracionMs, enHoras, soloFecha, soloHora } from '../lib/tiempo';

/** Los turnos propios. El registro completo del taller sigue siendo solo del admin. */
export default function MisTurnos() {
  const [turnos, setTurnos] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let vivo = true;
    fetch('/api/perfil/turnos', { cache: 'no-store' })
      .then(async (r) => {
        const cuerpo = await r.json().catch(() => ({}));
        if (!vivo) return;
        if (!r.ok) setError(cuerpo.error || 'No se pudo cargar.');
        else setTurnos(cuerpo.turnos);
      })
      .catch(() => vivo && setError('Sin conexión con el servidor.'));
    return () => {
      vivo = false;
    };
  }, []);

  const resumen = useMemo(() => {
    if (!turnos) return null;
    const ahora = Date.now();
    const total = turnos.reduce((s, t) => s + duracionMs(t, ahora), 0);
    // Los últimos 7 días, contando desde hoy hacia atrás.
    const desde = ahora - 7 * 24 * 3600 * 1000;
    const semana = turnos
      .filter((t) => Date.parse(t.entrada) >= desde)
      .reduce((s, t) => s + duracionMs(t, ahora), 0);
    return { total, semana, abierto: turnos.some((t) => !t.salida) };
  }, [turnos]);

  if (error) return <p className="forma-error">{error}</p>;
  if (!turnos) return <p className="mis-cargando">Cargando…</p>;

  if (!turnos.length) {
    return (
      <p className="mis-vacio">
        Todavía no tienes turnos registrados. Marca tu entrada y aparecerán acá.
      </p>
    );
  }

  return (
    <>
      <div className="mis-resumen">
        <div className="mis-ficha">
          <span className="mis-rotulo">Últimos 7 días</span>
          <span className="mis-cifra">{enHoras(resumen.semana)}</span>
        </div>
        <div className="mis-ficha">
          <span className="mis-rotulo">Total acumulado</span>
          <span className="mis-cifra">{enHoras(resumen.total)}</span>
        </div>
      </div>

      {resumen.abierto && (
        <p className="mis-aviso">
          Tienes un turno abierto: su tiempo sigue sumando hasta que marques la salida.
        </p>
      )}

      <ul className="mis-lista">
        {turnos.map((t) => (
          <li key={t.id} className={t.salida ? '' : 'abierto'}>
            <span className="mis-dia">
              <span className="mis-diasem">{diaCorto(t.entrada)}</span> {soloFecha(t.entrada)}
            </span>
            <span className="mis-horario">
              {soloHora(t.entrada)} → {t.salida ? soloHora(t.salida) : <em>en turno</em>}
            </span>
            <span className="mis-horas">{enHoras(duracionMs(t))}</span>
            {t.cerradoAuto && (
              <span className="mis-motivo">
                Se cerró solo al cumplir las 2 horas abiertas.
              </span>
            )}
            {/* Si al mecánico le corrigieron las horas, tiene derecho a saber por qué. */}
            {t.corregido && (
              <span className="mis-motivo">
                Corregido por {t.corregido}
                {t.nota ? `: «${t.nota}»` : ''}
              </span>
            )}
          </li>
        ))}
      </ul>

      <p className="forma-pie">
        Horas en hora de Chile. Si ves algo mal, avísale al encargado: las correcciones las
        hace él desde el registro.
      </p>
    </>
  );
}
