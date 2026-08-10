'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { SECCIONES, COMANDOS, CODIGOS } from '../lib/catalogo';
import Marcaje from './marcaje';

const pesos = new Intl.NumberFormat('es-CL');
const money = (n) => `$${pesos.format(n)}`;

const limpiar = (s) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

/* Lectura del total: sube hasta la cifra como un surtidor de bencina. */
function useConteo(valor) {
  const [visible, setVisible] = useState(valor);
  const anterior = useRef(valor);

  useEffect(() => {
    const reducido =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const desde = anterior.current;
    anterior.current = valor;

    if (reducido || desde === valor) {
      setVisible(valor);
      return;
    }

    const inicio = performance.now();
    const duracion = 260;
    let cuadro;

    const paso = (ahora) => {
      const t = Math.min(1, (ahora - inicio) / duracion);
      const suave = 1 - Math.pow(1 - t, 3);
      setVisible(Math.round(desde + (valor - desde) * suave));
      if (t < 1) cuadro = requestAnimationFrame(paso);
    };

    cuadro = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(cuadro);
  }, [valor]);

  return visible;
}

function Contador({ valor, onCambio, etiqueta }) {
  return (
    <div className="contador">
      <button
        type="button"
        onClick={() => onCambio(valor - 1)}
        disabled={valor <= 0}
        aria-label={`Quitar uno de ${etiqueta}`}
      >
        −
      </button>
      <input
        type="number"
        inputMode="numeric"
        min="0"
        value={valor === 0 ? '' : valor}
        placeholder="0"
        aria-label={`Cantidad de ${etiqueta}`}
        onChange={(e) => {
          const n = parseInt(e.target.value, 10);
          onCambio(Number.isNaN(n) ? 0 : n);
        }}
      />
      <button
        type="button"
        onClick={() => onCambio(valor + 1)}
        aria-label={`Agregar uno de ${etiqueta}`}
      >
        +
      </button>
    </div>
  );
}

export default function Boleta({ nombre, admin, turnoAbierto }) {
  const [cantidades, setCantidades] = useState({});
  const [filtro, setFiltro] = useState('');
  const [abiertas, setAbiertas] = useState(() => new Set(['principales']));
  const [copiado, setCopiado] = useState(false);

  const ponerCantidad = (clave, n) =>
    setCantidades((prev) => {
      const limpio = Math.max(0, Math.min(999, Math.floor(n) || 0));
      if (limpio === 0) {
        const { [clave]: _, ...resto } = prev;
        return resto;
      }
      return { ...prev, [clave]: limpio };
    });

  const busqueda = limpiar(filtro.trim());

  const vista = useMemo(
    () =>
      SECCIONES.map((seccion) => {
        const items = seccion.items
          .map((item, i) => ({ ...item, clave: `${seccion.id}:${i}` }))
          .filter((item) => !busqueda || limpiar(item.nombre).includes(busqueda));

        const subtotal = seccion.items.reduce(
          (suma, item, i) => suma + (cantidades[`${seccion.id}:${i}`] || 0) * item.precio,
          0
        );

        const elegidos = seccion.items.filter((_, i) => cantidades[`${seccion.id}:${i}`]).length;

        return { ...seccion, items, subtotal, elegidos };
      }),
    [cantidades, busqueda]
  );

  const total = vista.reduce((suma, s) => suma + s.subtotal, 0);
  const unidades = Object.values(cantidades).reduce((a, b) => a + b, 0);
  const distintos = Object.keys(cantidades).length;
  const totalVisible = useConteo(total);
  const conResultados = vista.some((s) => s.items.length > 0);

  useEffect(() => {
    if (!copiado) return;
    const t = setTimeout(() => setCopiado(false), 1800);
    return () => clearTimeout(t);
  }, [copiado]);

  const alternar = (id) =>
    setAbiertas((prev) => {
      const siguiente = new Set(prev);
      siguiente.has(id) ? siguiente.delete(id) : siguiente.add(id);
      return siguiente;
    });

  const textoBoleta = () => {
    const lineas = ['SUNSET MOTORS — Boleta de cobro', ''];
    SECCIONES.forEach((seccion) => {
      const filas = seccion.items
        .map((item, i) => ({ item, cant: cantidades[`${seccion.id}:${i}`] || 0 }))
        .filter((f) => f.cant > 0);
      if (!filas.length) return;
      lineas.push(seccion.titulo.toUpperCase());
      filas.forEach(({ item, cant }) =>
        lineas.push(`  ${cant}x ${item.nombre} — ${money(cant * item.precio)}`)
      );
      lineas.push('');
    });
    lineas.push(`TOTAL A COBRAR: ${money(total)}`);
    if (nombre) lineas.push(`Atendió: ${nombre}`);
    return lineas.join('\n');
  };

  const copiarBoleta = async () => {
    const texto = textoBoleta();
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
    } catch {
      window.prompt('Copia la boleta desde aquí:', texto.replace(/\n/g, ' | '));
    }
  };

  const borrarTodo = () => {
    setCantidades({});
    setFiltro('');
  };

  const salir = async () => {
    await fetch('/api/logout', { method: 'POST' }).catch(() => {});
    window.location.href = '/login';
  };

  return (
    <>
      <div className="franja" />
      <main className="envoltura">
        <header className="marca">
          <h1 className="marca-nombre">
            SUNSET <em>MOTORS</em>
          </h1>
          <p className="marca-bajada">Boleta de cobro · Taller mecánico</p>
          <div className="sesion">
            <span className="sesion-nombre">Turno de {nombre}</span>
            <span className="sesion-acciones">
              {admin && (
                <a className="accion" href="/admin">
                  Registro
                </a>
              )}
              <button type="button" className="accion" onClick={salir}>
                Salir
              </button>
            </span>
          </div>
        </header>

        <Marcaje abiertoInicial={turnoAbierto} />

        <div className="buscador">
          <input
            type="search"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            placeholder="Buscar repuesto o servicio…"
            aria-label="Buscar repuesto o servicio"
          />
        </div>

        <div className="secciones">
          {vista.map((seccion) => {
            const abierta = abiertas.has(seccion.id) || Boolean(busqueda);
            if (busqueda && seccion.items.length === 0) return null;

            return (
              <section
                className="seccion"
                key={seccion.id}
                style={{ '--tinte': seccion.tinte }}
              >
                <button
                  type="button"
                  className="seccion-cabeza"
                  onClick={() => alternar(seccion.id)}
                  aria-expanded={abierta}
                >
                  <span className={`flecha ${abierta ? 'abierta' : ''}`} />
                  <span className="seccion-titulo">{seccion.titulo}</span>
                  {seccion.elegidos > 0 && (
                    <span className="seccion-cuenta">{seccion.elegidos} ítem
                      {seccion.elegidos > 1 ? 's' : ''}</span>
                  )}
                  <span
                    className={`seccion-subtotal ${seccion.subtotal > 0 ? 'activo' : ''}`}
                  >
                    {money(seccion.subtotal)}
                  </span>
                </button>

                {abierta && (
                  <div className="seccion-cuerpo">
                    {seccion.items.map((item) => {
                      const cant = cantidades[item.clave] || 0;
                      return (
                        <div
                          className={`item ${cant > 0 ? 'marcado' : ''}`}
                          key={item.clave}
                        >
                          <div className="item-texto">
                            <div className="item-nombre">{item.nombre}</div>
                            <div className="item-precio">
                              {item.revisar ? (
                                <span className="aviso">precio por definir</span>
                              ) : (
                                `${money(item.precio)} c/u`
                              )}
                            </div>
                          </div>
                          <Contador
                            valor={cant}
                            etiqueta={item.nombre}
                            onCambio={(n) => ponerCantidad(item.clave, n)}
                          />
                          <div className="item-total">
                            {cant > 0 ? money(cant * item.precio) : '—'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>

        {!conResultados && (
          <p className="vacio">Nada coincide con «{filtro}». Prueba con otra palabra.</p>
        )}

        <div className="surtidor">
          <div className="surtidor-fila">
            <span className="surtidor-rotulo">Total a cobrar</span>
            <span className="surtidor-cifra">{money(totalVisible)}</span>
          </div>
          <div className="surtidor-detalle">
            <span>
              {distintos === 0
                ? 'Sin ítems'
                : `${distintos} ítem${distintos > 1 ? 's' : ''} · ${unidades} unidad${
                    unidades > 1 ? 'es' : ''
                  }`}
            </span>
            <span className="surtidor-acciones">
              <button
                type="button"
                className="accion"
                onClick={copiarBoleta}
                disabled={distintos === 0}
              >
                {copiado ? 'Copiada' : 'Copiar boleta'}
              </button>
              <button
                type="button"
                className="accion"
                onClick={borrarTodo}
                disabled={distintos === 0 && !filtro}
              >
                Limpiar
              </button>
            </span>
          </div>
        </div>

        <div className="referencia">
          <div>
            <h2 className="ref-titulo">Comandos</h2>
            <ul className="ref-lista">
              {COMANDOS.map((c) => (
                <li key={c.comando}>
                  <span className="ref-clave">{c.comando}</span>
                  <span className="ref-valor">{c.descripcion}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="ref-titulo">Códigos de radio</h2>
            <ul className="ref-lista">
              {CODIGOS.map((c) => (
                <li key={c.codigo}>
                  <span className="ref-clave">{c.codigo}</span>
                  <span className="ref-valor">{c.descripcion}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className="pie">
          Las cantidades viven solo en este dispositivo y se borran al cerrar la pestaña.
          Dos personas pueden calcular al mismo tiempo sin pisarse.
        </p>
      </main>
    </>
  );
}
