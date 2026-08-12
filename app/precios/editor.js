'use client';

import { useState } from 'react';
import Barra from '../barra';
// De catalogo.js y no de precios.js: este componente corre en el navegador, y precios.js
// arrastra lib/almacen.js, que usa node:fs.
import { TINTES } from '../../lib/catalogo';
import { soloFecha, soloHora } from '../../lib/tiempo';

const pesos = new Intl.NumberFormat('es-CL');
const money = (n) => `$${pesos.format(n)}`;

const idNuevo = () => Math.random().toString(36).slice(2, 10);

/** Título → identificador: «Partes de servicio» -> «partes-de-servicio». */
const aId = (titulo) =>
  titulo
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 30) || `seccion-${idNuevo().slice(0, 4)}`;

export default function Editor({ usuario, catalogo, accesos, sinEditar, turnoPropio }) {
  const [secciones, setSecciones] = useState(catalogo.secciones);
  const [turno, setTurno] = useState(turnoPropio);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [tocado, setTocado] = useState(false);
  const [meta, setMeta] = useState({
    actualizado: catalogo.actualizado,
    actualizadoPor: catalogo.actualizadoPor,
    sinEditar,
  });

  const cambiar = (fn) => {
    setSecciones(fn);
    setTocado(true);
    setAviso('');
  };

  // ---------- Secciones ----------

  const cambiarSeccion = (i, campo, valor) =>
    cambiar((p) => p.map((s, j) => (j === i ? { ...s, [campo]: valor } : s)));

  const moverSeccion = (i, paso) =>
    cambiar((p) => {
      const j = i + paso;
      if (j < 0 || j >= p.length) return p;
      const copia = [...p];
      [copia[i], copia[j]] = [copia[j], copia[i]];
      return copia;
    });

  const borrarSeccion = (i) => {
    if (!window.confirm(`¿Eliminar la sección «${secciones[i].titulo}» con todos sus ítems?`)) {
      return;
    }
    cambiar((p) => p.filter((_, j) => j !== i));
  };

  const agregarSeccion = () =>
    cambiar((p) => [
      ...p,
      {
        id: `seccion-${idNuevo().slice(0, 4)}`,
        titulo: 'Sección nueva',
        tinte: TINTES[p.length % TINTES.length],
        items: [{ id: idNuevo(), nombre: 'Ítem nuevo', precio: 0 }],
      },
    ]);

  // ---------- Ítems ----------

  const cambiarItem = (si, ii, campo, valor) =>
    cambiar((p) =>
      p.map((s, j) =>
        j !== si
          ? s
          : { ...s, items: s.items.map((it, k) => (k === ii ? { ...it, [campo]: valor } : it)) }
      )
    );

  const moverItem = (si, ii, paso) =>
    cambiar((p) =>
      p.map((s, j) => {
        if (j !== si) return s;
        const k = ii + paso;
        if (k < 0 || k >= s.items.length) return s;
        const items = [...s.items];
        [items[ii], items[k]] = [items[k], items[ii]];
        return { ...s, items };
      })
    );

  const borrarItem = (si, ii) =>
    cambiar((p) =>
      p.map((s, j) => (j !== si ? s : { ...s, items: s.items.filter((_, k) => k !== ii) }))
    );

  const agregarItem = (si) =>
    cambiar((p) =>
      p.map((s, j) =>
        j !== si ? s : { ...s, items: [...s.items, { id: idNuevo(), nombre: '', precio: 0 }] }
      )
    );

  // ---------- Guardar ----------

  const guardar = async () => {
    setOcupado(true);
    setError('');
    setAviso('');
    try {
      // El id de sección se recalcula del título solo si quedó con la forma automática:
      // así renombrar no rompe secciones que ya venían con id propio.
      const listas = secciones.map((s) => ({
        ...s,
        id: /^seccion-[a-z0-9]{4}$/.test(s.id) ? aId(s.titulo) : s.id,
        items: s.items.map((it) => ({ ...it, precio: Number(it.precio) || 0 })),
      }));

      const r = await fetch('/api/precios', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secciones: listas }),
      });
      const cuerpo = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(cuerpo.error || 'No se pudo guardar.');
        return;
      }
      setSecciones(cuerpo.catalogo.secciones);
      setMeta({ ...cuerpo.catalogo, sinEditar: false });
      setTocado(false);
      setAviso('Precios guardados. Ya los ve todo el taller.');
    } catch {
      setError('Sin conexión con el servidor.');
    } finally {
      setOcupado(false);
    }
  };

  const restaurar = async () => {
    if (!window.confirm('¿Volver al catálogo original? Se pierden todos tus cambios guardados.')) {
      return;
    }
    setOcupado(true);
    setError('');
    try {
      const r = await fetch('/api/precios', { method: 'POST' });
      const cuerpo = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(cuerpo.error || 'No se pudo restaurar.');
        return;
      }
      setSecciones(cuerpo.catalogo.secciones);
      setMeta({ ...cuerpo.catalogo, sinEditar: false });
      setTocado(false);
      setAviso('Catálogo restaurado al original.');
    } finally {
      setOcupado(false);
    }
  };

  const totalItems = secciones.reduce((s, x) => s + x.items.length, 0);

  return (
    <>
      <Barra
        usuario={usuario}
        admin
        accesos={accesos}
        seccion="precios"
        turno={turno}
        onTurnoCambio={setTurno}
      />
      <main className="envoltura">
        <header className="titulo">
          <div>
            <h1 className="titulo-texto">Precios</h1>
            <p className="titulo-bajada">
              {meta.sinEditar
                ? 'Catálogo original · todavía sin editar'
                : `Actualizados el ${soloFecha(meta.actualizado)} a las ${soloHora(meta.actualizado)} por ${meta.actualizadoPor}`}
            </p>
          </div>
          <span className="soli-acciones">
            {!meta.sinEditar && (
              <button type="button" className="accion" disabled={ocupado} onClick={restaurar}>
                Volver al original
              </button>
            )}
            <button
              type="button"
              className="accion destacada"
              disabled={ocupado || !tocado}
              onClick={guardar}
            >
              {ocupado ? 'Guardando…' : tocado ? 'Guardar cambios' : 'Sin cambios'}
            </button>
          </span>
        </header>

        {error && <p className="panel-error">{error}</p>}
        {aviso && <p className="mecanicos-aviso">{aviso}</p>}

        {tocado && (
          <p className="panel-aviso">
            Tienes cambios sin guardar. La calculadora sigue mostrando los precios anteriores
            hasta que pulses «Guardar cambios».
          </p>
        )}

        <div className="precios-lista">
          {secciones.map((s, si) => (
            <section className="precio-seccion" key={s.id} style={{ '--tinte': s.tinte }}>
              <div className="precio-cabeza">
                <input
                  className="precio-titulo"
                  value={s.titulo}
                  maxLength={40}
                  onChange={(e) => cambiarSeccion(si, 'titulo', e.target.value)}
                  aria-label="Título de la sección"
                />
                <span className="precio-tintes">
                  {TINTES.map((t) => (
                    <button
                      key={t}
                      type="button"
                      className={`tinte ${s.tinte === t ? 'elegido' : ''}`}
                      style={{ background: t }}
                      onClick={() => cambiarSeccion(si, 'tinte', t)}
                      aria-label={`Color ${t}`}
                    />
                  ))}
                </span>
                <span className="precio-orden">
                  <button type="button" className="accion" onClick={() => moverSeccion(si, -1)}>
                    ↑
                  </button>
                  <button type="button" className="accion" onClick={() => moverSeccion(si, 1)}>
                    ↓
                  </button>
                  <button
                    type="button"
                    className="accion peligro"
                    onClick={() => borrarSeccion(si)}
                  >
                    Eliminar
                  </button>
                </span>
              </div>

              <div className="precio-items">
                {s.items.map((it, ii) => (
                  <div className="precio-item" key={it.id}>
                    <input
                      value={it.nombre}
                      maxLength={60}
                      placeholder="Nombre del ítem"
                      onChange={(e) => cambiarItem(si, ii, 'nombre', e.target.value)}
                      aria-label="Nombre del ítem"
                    />
                    <input
                      type="number"
                      min="0"
                      value={it.precio}
                      onChange={(e) => cambiarItem(si, ii, 'precio', e.target.value)}
                      aria-label="Precio"
                    />
                    <label className="campo-casilla" title="Muestra «precio por definir»">
                      <input
                        type="checkbox"
                        checked={Boolean(it.revisar)}
                        onChange={(e) => cambiarItem(si, ii, 'revisar', e.target.checked)}
                      />
                      <span>Revisar</span>
                    </label>
                    <span className="precio-orden">
                      <button type="button" className="accion" onClick={() => moverItem(si, ii, -1)}>
                        ↑
                      </button>
                      <button type="button" className="accion" onClick={() => moverItem(si, ii, 1)}>
                        ↓
                      </button>
                      <button
                        type="button"
                        className="accion peligro"
                        onClick={() => borrarItem(si, ii)}
                      >
                        ✕
                      </button>
                    </span>
                  </div>
                ))}
              </div>

              <button type="button" className="accion" onClick={() => agregarItem(si)}>
                Agregar ítem
              </button>
            </section>
          ))}
        </div>

        <button type="button" className="accion destacada precio-nueva" onClick={agregarSeccion}>
          Agregar sección
        </button>

        <div className="surtidor dev-total">
          <div className="surtidor-fila">
            <span className="surtidor-rotulo">Ítems en el catálogo</span>
            <span className="surtidor-cifra">{totalItems}</span>
          </div>
          <div className="surtidor-detalle">
            <span>
              {secciones.length} secciones · el más caro:{' '}
              {money(Math.max(0, ...secciones.flatMap((s) => s.items.map((i) => Number(i.precio) || 0))))}
            </span>
          </div>
        </div>

        <p className="pie">
          El orden de las secciones acá es el orden en pantalla: se reparten en dos columnas,
          izquierda y derecha. «Revisar» hace que el ítem muestre «precio por definir» en vez
          del monto, pero el precio igual se suma al total.
        </p>
      </main>
    </>
  );
}
