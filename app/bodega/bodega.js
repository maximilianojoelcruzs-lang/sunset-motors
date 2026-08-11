'use client';

import { useMemo, useState } from 'react';
import Barra from '../barra';
import Dialogo from '../dialogo';
import Escaner from './escaner';
import { soloFecha, soloHora } from '../../lib/tiempo';

const limpiar = (s) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export default function Bodega({ usuario, admin, inicial, turnoPropio, fallo }) {
  const [bodega, setBodega] = useState(inicial);
  const [turno, setTurno] = useState(turnoPropio);
  const [filtro, setFiltro] = useState('');
  const [escaneando, setEscaneando] = useState(false);
  const [editando, setEditando] = useState(false);
  const [borrador, setBorrador] = useState([]);
  const [error, setError] = useState(fallo);
  const [aviso, setAviso] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const guardar = async (items, exito) => {
    setOcupado(true);
    setError('');
    setAviso('');
    try {
      const r = await fetch('/api/bodega', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      const cuerpo = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(cuerpo.error || 'No se pudo guardar.');
        return false;
      }
      setBodega({ ...cuerpo.bodega, hayAnterior: true });
      setAviso(exito);
      return true;
    } catch {
      setError('Sin conexión con el servidor.');
      return false;
    } finally {
      setOcupado(false);
    }
  };

  const restaurar = async () => {
    if (!window.confirm('¿Volver a la versión anterior del inventario?')) return;
    setOcupado(true);
    setError('');
    try {
      const r = await fetch('/api/bodega', { method: 'POST' });
      const cuerpo = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(cuerpo.error || 'No se pudo restaurar.');
        return;
      }
      setBodega({ ...cuerpo.bodega, hayAnterior: true });
      setAviso('Inventario restaurado a la versión anterior.');
    } finally {
      setOcupado(false);
    }
  };

  const busqueda = limpiar(filtro.trim());
  const visibles = useMemo(
    () => bodega.items.filter((i) => !busqueda || limpiar(i.nombre).includes(busqueda)),
    [bodega.items, busqueda]
  );
  const unidades = bodega.items.reduce((s, i) => s + i.cantidad, 0);

  return (
    <>
      <Barra
        usuario={usuario}
        admin={admin}
        seccion="bodega"
        turno={turno}
        onTurnoCambio={setTurno}
      />
      <main className="envoltura">
        <header className="titulo">
          <div>
            <h1 className="titulo-texto">Bodega</h1>
            <p className="titulo-bajada">
              {bodega.actualizado
                ? `Actualizada el ${soloFecha(bodega.actualizado)} a las ${soloHora(bodega.actualizado)} por ${bodega.actualizadoPor}`
                : 'Todavía sin registrar'}
            </p>
          </div>
          <span className="soli-acciones">
            {admin && bodega.hayAnterior && (
              <button type="button" className="accion" disabled={ocupado} onClick={restaurar}>
                Deshacer
              </button>
            )}
            <button
              type="button"
              className="accion destacada"
              onClick={() => setEscaneando(true)}
            >
              Actualizar con captura
            </button>
          </span>
        </header>

        {error && <p className="panel-error">{error}</p>}
        {aviso && <p className="mecanicos-aviso">{aviso}</p>}

        {bodega.items.length === 0 ? (
          <p className="vacio">
            La bodega está vacía. Sube una captura del inventario del juego para registrarla.
          </p>
        ) : (
          <>
            <div className="buscador">
              <input
                type="search"
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
                placeholder="Buscar producto…"
                aria-label="Buscar producto"
              />
            </div>

            {editando ? (
              <section className="soli-nueva">
                <h2 className="ref-titulo">Editando a mano</h2>
                <div className="escaner-filas">
                  {borrador.map((f, i) => (
                    <div className="escaner-fila" key={i}>
                      <input
                        type="text"
                        value={f.nombre}
                        maxLength={60}
                        onChange={(e) =>
                          setBorrador((p) =>
                            p.map((x, j) => (j === i ? { ...x, nombre: e.target.value } : x))
                          )
                        }
                      />
                      <input
                        type="number"
                        min="1"
                        value={f.cantidad}
                        onChange={(e) =>
                          setBorrador((p) =>
                            p.map((x, j) => (j === i ? { ...x, cantidad: e.target.value } : x))
                          )
                        }
                      />
                      <button
                        type="button"
                        className="accion peligro"
                        onClick={() => setBorrador((p) => p.filter((_, j) => j !== i))}
                      >
                        Quitar
                      </button>
                    </div>
                  ))}
                </div>
                <div className="soli-botones">
                  <button
                    type="button"
                    className="accion"
                    onClick={() => setBorrador((p) => [...p, { nombre: '', cantidad: 1 }])}
                  >
                    Agregar línea
                  </button>
                  <button
                    type="button"
                    className="accion destacada"
                    disabled={ocupado}
                    onClick={async () => {
                      const ok = await guardar(
                        borrador.filter((f) => String(f.nombre).trim()),
                        'Inventario actualizado.'
                      );
                      if (ok) setEditando(false);
                    }}
                  >
                    Guardar
                  </button>
                  <button type="button" className="accion" onClick={() => setEditando(false)}>
                    Cancelar
                  </button>
                </div>
              </section>
            ) : (
              <>
                <div className="tabla-envoltura">
                  <table className="tabla">
                    <thead>
                      <tr>
                        <th>Producto</th>
                        <th>Cantidad</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibles.map((i) => (
                        <tr key={i.nombre}>
                          <td data-rotulo="Producto">{i.nombre}</td>
                          <td data-rotulo="Cantidad">
                            <span className="bodega-cantidad">{i.cantidad}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {visibles.length === 0 && (
                  <p className="vacio">Ningún producto coincide con «{filtro}».</p>
                )}

                <div className="surtidor dev-total">
                  <div className="surtidor-fila">
                    <span className="surtidor-rotulo">Productos distintos</span>
                    <span className="surtidor-cifra">{bodega.items.length}</span>
                  </div>
                  <div className="surtidor-detalle">
                    <span>{unidades} unidades en total</span>
                    <span className="surtidor-acciones">
                      <button
                        type="button"
                        className="accion"
                        onClick={() => {
                          setBorrador(bodega.items.map((i) => ({ ...i })));
                          setEditando(true);
                        }}
                      >
                        Editar a mano
                      </button>
                    </span>
                  </div>
                </div>
              </>
            )}
          </>
        )}

        <p className="pie">
          La captura se lee en tu propio navegador y no se guarda en ninguna parte: solo queda
          la lista que confirmes. La versión anterior se conserva por si un escaneo sale mal.
        </p>
      </main>

      {escaneando && (
        <Dialogo titulo="Actualizar con captura" onCerrar={() => setEscaneando(false)}>
          <Escaner
            actuales={bodega.items}
            onCancelar={() => setEscaneando(false)}
            onListo={async (items, modo) => {
              const limpios = items.map((f) => ({
                nombre: String(f.nombre).trim(),
                cantidad: Number(f.cantidad) || 1,
              }));
              const finales = modo === 'sumar' ? [...bodega.items, ...limpios] : limpios;
              const ok = await guardar(
                finales,
                modo === 'sumar' ? 'Productos sumados al inventario.' : 'Inventario reemplazado.'
              );
              if (ok) setEscaneando(false);
            }}
          />
        </Dialogo>
      )}
    </>
  );
}
