'use client';

import { useEffect, useState } from 'react';

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

/** Reparto de fichas del casino y últimas jugadas de todo el mundo. */
export default function Fichas() {
  const [datos, setDatos] = useState(null);
  const [abierto, setAbierto] = useState(false);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const cargar = async () => {
    try {
      const r = await fetch('/api/casino/fichas', { cache: 'no-store' });
      const cuerpo = await r.json().catch(() => ({}));
      if (r.ok) setDatos(cuerpo);
      else setError(cuerpo.error || 'No se pudo cargar.');
    } catch {
      setError('Sin conexión con el servidor.');
    }
  };

  useEffect(() => {
    if (abierto && !datos) cargar();
  }, [abierto, datos]);

  const ajustar = async (usuario, cantidad) => {
    setOcupado(true);
    setError('');
    setAviso('');
    try {
      const r = await fetch('/api/casino/fichas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario, cantidad }),
      });
      const cuerpo = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(cuerpo.error || 'No se pudo completar.');
        return;
      }
      setAviso(
        `${cantidad > 0 ? 'Recargadas' : 'Descontadas'} ${fmt.format(Math.abs(cantidad))} fichas a ` +
          `${usuario}. Ahora tiene ${fmt.format(cuerpo.saldo)}.`
      );
      await cargar();
    } finally {
      setOcupado(false);
    }
  };

  const pedirCantidad = (usuario, signo) => {
    const valor = window.prompt(
      `${signo > 0 ? 'Recargar' : 'Descontar'} fichas a ${usuario}:`,
      '1000'
    );
    if (!valor) return;
    const n = Math.abs(Math.round(Number(valor)));
    if (!Number.isFinite(n) || n <= 0) {
      setError('Pon un número de fichas válido.');
      return;
    }
    ajustar(usuario, n * signo);
  };

  return (
    <section className="mecanicos">
      <button
        type="button"
        className="mecanicos-cabeza"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
      >
        <span className={`flecha ${abierto ? 'abierta' : ''}`} />
        <span className="ref-titulo">Fichas del casino</span>
        {datos && <span className="mecanicos-cuenta">{datos.cuentas.length}</span>}
      </button>

      {abierto && (
        <div className="mecanicos-cuerpo">
          {error && <p className="panel-error">{error}</p>}
          {aviso && <p className="mecanicos-aviso">{aviso}</p>}

          {!datos ? (
            <p className="mis-cargando">Cargando…</p>
          ) : (
            <>
              <ul className="mecanicos-lista">
                {datos.cuentas.map((c) => (
                  <li key={c.usuario}>
                    <span className="mecanicos-nombre">
                      {c.usuario}
                      <span className="fichas-saldo">{fmt.format(c.saldo)} fichas</span>
                    </span>
                    <span className="fila-acciones">
                      <button
                        type="button"
                        className="accion destacada"
                        disabled={ocupado}
                        onClick={() => pedirCantidad(c.usuario, 1)}
                      >
                        Recargar
                      </button>
                      <button
                        type="button"
                        className="accion peligro"
                        disabled={ocupado}
                        onClick={() => pedirCantidad(c.usuario, -1)}
                      >
                        Descontar
                      </button>
                    </span>
                  </li>
                ))}
              </ul>

              {datos.jugadas.length > 0 && (
                <>
                  <h3 className="ref-titulo">Últimas jugadas</h3>
                  <div className="tabla-envoltura">
                    <table className="tabla">
                      <thead>
                        <tr>
                          <th>Cuándo</th>
                          <th>Quién</th>
                          <th>Juego</th>
                          <th>Detalle</th>
                          <th>Neto</th>
                        </tr>
                      </thead>
                      <tbody>
                        {datos.jugadas.slice(0, 20).map((j) => (
                          <tr key={j.id}>
                            <td data-rotulo="Cuándo">{cuando(j.cuando)}</td>
                            <td data-rotulo="Quién">
                              <span className="celda-usuario">{j.usuario}</span>
                            </td>
                            <td data-rotulo="Juego">{j.juego}</td>
                            <td data-rotulo="Detalle">{j.detalle}</td>
                            <td data-rotulo="Neto">
                              <span className={j.neto >= 0 ? 'neto-mas' : 'neto-menos'}>
                                {j.neto >= 0 ? '+' : ''}
                                {fmt.format(j.neto)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          )}

          <p className="mecanicos-pie">
            Las fichas son de rol: no se compran, no valen dinero y no se convierten en dinero.
            Cada movimiento queda registrado con tu nombre.
          </p>
        </div>
      )}
    </section>
  );
}
