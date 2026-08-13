'use client';

import { useEffect, useState } from 'react';
import useSondeo from '../sondeo';

const fmt = new Intl.NumberFormat('es-CL');

const cuando = (iso) =>
  new Intl.DateTimeFormat('es-CL', {
    timeZone: 'America/Santiago',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));

/**
 * Los retiros que pide la gente del casino.
 *
 * Las fichas ya están descontadas cuando la solicitud llega acá: lo único que falta es
 * entregar el dinero dentro del juego y marcarlo. **Rechazar devuelve las fichas**, así que
 * no deja a nadie sin nada por una entrega que no se pudo hacer.
 */
export default function Retiros() {
  const [retiros, setRetiros] = useState(null);
  const [abierto, setAbierto] = useState(false);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const cargar = async () => {
    try {
      const r = await fetch('/api/casino/retiros?todas=1', { cache: 'no-store' });
      const cuerpo = await r.json().catch(() => ({}));
      if (r.ok) setRetiros(cuerpo.retiros ?? []);
      else setError(cuerpo.error || 'No se pudo cargar.');
    } catch {
      setError('Sin conexión con el servidor.');
    }
  };

  // Se consulta siempre, esté abierto o no: el número de pendientes va en la cabecera y es
  // justamente lo que hay que ver sin abrir nada.
  useEffect(() => {
    cargar();
  }, []);
  useSondeo(cargar, 20000);

  const resolver = async (retiro, estado) => {
    const motivo =
      estado === 'rechazado'
        ? window.prompt(`¿Por qué rechazas el retiro de ${retiro.usuario}? (opcional)`) ?? ''
        : '';

    setOcupado(true);
    setError('');
    setAviso('');
    try {
      const r = await fetch(`/api/casino/retiros/${retiro.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado, motivo }),
      });
      const cuerpo = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(cuerpo.error || 'No se pudo resolver.');
        return;
      }
      setAviso(
        estado === 'entregado'
          ? `Marcado como entregado a ${retiro.usuario}.`
          : `Rechazado. Le devolvimos ${fmt.format(retiro.fichas)} fichas a ${retiro.usuario}.`
      );
      await cargar();
    } finally {
      setOcupado(false);
    }
  };

  const pendientes = (retiros ?? []).filter((r) => r.estado === 'pendiente');
  const resueltos = (retiros ?? []).filter((r) => r.estado !== 'pendiente');

  return (
    <section className="mecanicos">
      <button
        type="button"
        className="mecanicos-cabeza"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
      >
        <span className={`flecha ${abierto ? 'abierta' : ''}`} />
        <span className="ref-titulo">Retiros del casino</span>
        {pendientes.length > 0 && <span className="retiro-pendientes">{pendientes.length}</span>}
      </button>

      {abierto && (
        <div className="mecanicos-cuerpo">
          {error && <p className="panel-error">{error}</p>}
          {aviso && <p className="mecanicos-aviso">{aviso}</p>}

          {retiros === null ? (
            <p className="vacio">Cargando…</p>
          ) : pendientes.length === 0 ? (
            <p className="vacio">No hay retiros esperando.</p>
          ) : (
            <ul className="mecanicos-lista">
              {pendientes.map((r) => (
                <li key={r.id}>
                  <span className="mecanicos-nombre">
                    {r.usuario}
                    <span className="etiqueta-admin">{fmt.format(r.fichas)} fichas</span>
                    <span className="retiro-fecha">{cuando(r.pedido)}</span>
                    {r.nota && <span className="retiro-nota">«{r.nota}»</span>}
                  </span>
                  <span className="fila-acciones">
                    <button
                      type="button"
                      className="accion destacada"
                      disabled={ocupado}
                      onClick={() => resolver(r, 'entregado')}
                    >
                      Ya se lo entregué
                    </button>
                    <button
                      type="button"
                      className="accion peligro"
                      disabled={ocupado}
                      onClick={() => resolver(r, 'rechazado')}
                    >
                      Rechazar
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}

          {resueltos.length > 0 && (
            <div className="retiro-lista">
              <h3 className="ref-titulo">Ya resueltos</h3>
              <ul>
                {resueltos.slice(0, 12).map((r) => (
                  <li key={r.id}>
                    <span className={`retiro-estado ${r.estado}`}>{r.estado}</span>
                    <strong>{r.usuario}</strong>
                    <em>
                      {fmt.format(r.fichas)} · {cuando(r.pedido)}
                      {r.resueltoPor ? ` · ${r.resueltoPor}` : ''}
                    </em>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="mecanicos-pie">
            Las fichas ya se descontaron cuando pidieron el retiro. Marcar «ya se lo entregué»
            solo cierra la solicitud; rechazar le devuelve las fichas a la persona.
          </p>
        </div>
      )}
    </section>
  );
}
