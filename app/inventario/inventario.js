'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Barra from '../barra';
import useSondeo from '../sondeo';
import { soloFecha, soloHora } from '../../lib/tiempo';
import { comparar, noVistos } from '../../lib/inventario-lectura';

const sinTildes = (texto) =>
  String(texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const peso = (kg) =>
  kg == null ? '—' : kg < 1 ? `${Math.round(kg * 1000)} g` : `${kg.toFixed(2)} kg`;

const cuando = (iso) => (iso ? `${soloFecha(iso)} ${soloHora(iso)}` : '—');

const ROTULOS = {
  nuevo: 'nuevo',
  cambia: 'cambia',
  igual: 'sin cambio',
  discrepa: 'se contradice',
  ilegible: 'ilegible',
};

/**
 * Una fila del inventario. El nombre y la cantidad se corrigen en el sitio.
 *
 * **El peso no se muestra.** No sirve para trabajar: lo que se busca es «cuántos frenos hay».
 * Se sigue guardando porque es lo único que distingue dos artículos que el juego enseña con el
 * mismo nombre cortado —«KIT DE REPARACI…» de 28 kg y de 8,28 kg—, pero solo sale a la vista
 * cuando hay dos que se llaman igual, que es cuando hace falta para no confundirse.
 */
function Articulo({ articulo, desempate, onCorregir, onBorrar }) {
  const [nombre, setNombre] = useState(articulo.nombre);
  const [cantidad, setCantidad] = useState(String(articulo.cantidad));
  const tocando = useRef(false);

  // La bodega es una sola y la toca cualquiera: cada 20 segundos llega lo que hay en el
  // servidor. Sin esto, un campo abierto se quedaba con el valor viejo para siempre y al
  // primer clic se lo escribía encima al cambio de otra persona. Mientras se está editando
  // manda lo tecleado; el resto del tiempo, el servidor.
  useEffect(() => {
    if (tocando.current) return;
    setNombre(articulo.nombre);
    setCantidad(String(articulo.cantidad));
  }, [articulo.nombre, articulo.cantidad]);

  const guardar = () => {
    tocando.current = false;
    if (nombre === articulo.nombre && cantidad === String(articulo.cantidad)) return;
    onCorregir(articulo, { nombre, cantidad });
  };

  return (
    <li className="inv-fila">
      {/* El juego enseña los nombres largos cortados; acá se escribe el entero una vez y una
          captura nueva ya no lo vuelve a truncar. */}
      <input
        className="inv-nombre"
        value={nombre}
        onChange={(e) => {
          tocando.current = true;
          setNombre(e.target.value);
        }}
        onBlur={guardar}
        onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
        maxLength={60}
        aria-label={`Nombre de ${articulo.nombre}`}
      />
      {desempate && (
        <span className="inv-desempate" title="Hay otro artículo con este mismo nombre">
          {peso(articulo.peso)}
        </span>
      )}
      <input
        className="inv-cantidad"
        value={cantidad}
        onChange={(e) => {
          tocando.current = true;
          setCantidad(e.target.value.replace(/[^\d]/g, ''));
        }}
        onBlur={guardar}
        onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
        maxLength={5}
        aria-label={`Cantidad de ${articulo.nombre}`}
      />
      <span className="inv-visto" title={`Última vez que se vio · ${articulo.vistoPor ?? '—'}`}>
        {cuando(articulo.visto)}
      </span>
      <button
        type="button"
        className="tun-quitar"
        onClick={() => onBorrar(articulo)}
        aria-label={`Quitar ${articulo.nombre}`}
      >
        ×
      </button>
    </li>
  );
}

export default function Inventario({
  usuario,
  admin,
  accesos,
  iniciales,
  cargasIniciales,
  turnoPropio,
  fallo,
}) {
  const [articulos, setArticulos] = useState(iniciales);
  const [cargas, setCargas] = useState(cargasIniciales);
  const [turno, setTurno] = useState(turnoPropio);
  const [filtro, setFiltro] = useState('');
  const [error, setError] = useState(fallo);
  const [ocupado, setOcupado] = useState(false);

  // El conteo en curso: lo leído de las capturas, antes de guardarse.
  const [leidos, setLeidos] = useState(null);
  const [completo, setCompleto] = useState(false);
  const campoNombre = useRef(null);

  const recargar = async () => {
    const r = await fetch('/api/inventario', { cache: 'no-store' });
    const cuerpo = await r.json().catch(() => ({}));
    if (r.ok) {
      setArticulos(cuerpo.articulos);
      setCargas(cuerpo.cargas);
    }
  };

  // La bodega es una sola y la actualiza cualquiera: la pantalla se entera sin apretar F5.
  useSondeo(() => (leidos ? undefined : recargar()), 20000);

  const pedir = async (url, opciones) => {
    setOcupado(true);
    setError('');
    try {
      const r = await fetch(url, opciones);
      const cuerpo = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(cuerpo.error || 'No se pudo completar.');
        return null;
      }
      if (cuerpo.articulos) setArticulos(cuerpo.articulos);
      return cuerpo;
    } catch {
      setError('Sin conexión con el servidor.');
      return null;
    } finally {
      setOcupado(false);
    }
  };

  // ---------- El conteo ----------
  //
  // Se compara en el navegador y se enseña **antes** de guardar. Es la misma regla que en el
  // tunning: algo que adivina mal en silencio deja el dato mintiendo, y un inventario que
  // miente se descubre en la bodega, buscando una pieza que no está.
  const filas = useMemo(() => {
    if (!leidos) return [];
    const base = comparar(leidos, articulos);
    return completo ? [...base, ...noVistos(articulos, base)] : base;
  }, [leidos, articulos, completo]);

  const resumen = useMemo(() => {
    const cuenta = (estado) => filas.filter((f) => f.estado === estado).length;
    return {
      nuevos: cuenta('nuevo'),
      cambian: filas.filter((f) => f.estado === 'cambia').length,
      iguales: cuenta('igual'),
      problemas: cuenta('discrepa') + cuenta('ilegible'),
    };
  }, [filas]);

  const anadirLeido = (e) => {
    e.preventDefault();
    const datos = new FormData(e.target);
    const nombre = String(datos.get('nombre') ?? '').trim();
    if (!nombre) return;

    setLeidos((antes) => [
      ...(antes ?? []),
      // Sin peso: anotando a mano el nombre es la clave. El peso lo pone el escáner, que sí lo
      // ve en la tarjeta.
      { nombre, cantidad: String(datos.get('cantidad') ?? '') },
    ]);
    e.target.reset();
    campoNombre.current?.focus();
  };

  const guardarConteo = async () => {
    const r = await pedir('/api/inventario', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filas }),
    });
    if (!r) return;
    setLeidos(null);
    setCompleto(false);
    await recargar();
  };

  const corregir = async (articulo, cambios) => {
    const r = await pedir(`/api/inventario/${articulo.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cambios),
    });
    if (r?.articulo) {
      setArticulos((antes) => antes.map((a) => (a.id === r.articulo.id ? r.articulo : a)));
    }
  };

  const borrar = (articulo) => {
    if (!window.confirm(`¿Quitar «${articulo.nombre}» del inventario?`)) return;
    pedir(`/api/inventario/${articulo.id}`, { method: 'DELETE' });
  };

  const busqueda = sinTildes(filtro.trim());
  const vista = busqueda
    ? articulos.filter((a) => sinTildes(a.nombre).includes(busqueda))
    : articulos;

  const totalUnidades = articulos.reduce((n, a) => n + a.cantidad, 0);

  // Los nombres que salen más de una vez. Solo esos enseñan el peso, para poder distinguirlos.
  const repetidos = useMemo(() => {
    const cuenta = new Map();
    for (const a of articulos) cuenta.set(a.nombre, (cuenta.get(a.nombre) ?? 0) + 1);
    return new Set([...cuenta].filter(([, n]) => n > 1).map(([nombre]) => nombre));
  }, [articulos]);

  return (
    <>
      <Barra
        usuario={usuario}
        admin={admin}
        accesos={accesos}
        seccion="inventario"
        turno={turno}
        onTurnoCambio={setTurno}
      />

      <main className="envoltura">
        <header className="titulo">
          <div>
            <h1 className="titulo-texto">Inventario</h1>
            <p className="titulo-bajada">
              {articulos.length} artículos · {totalUnidades.toLocaleString('es-CL')} unidades
            </p>
          </div>
          {!leidos && (
            <button
              type="button"
              className="tun-boton-fuerte"
              disabled={ocupado}
              onClick={() => setLeidos([])}
            >
              Registrar conteo
            </button>
          )}
        </header>

        {error && <p className="panel-error">{error}</p>}

        {/* ---------- Conteo en curso ---------- */}
        {leidos && (
          <section className="inv-conteo">
            <h2 className="ref-titulo">Conteo en curso</h2>
            <p className="tun-ayuda">
              Anota lo que ves en la bodega. La bodega no cabe en una pantalla, así que se baja y
              se sube: <strong>todo lo de una misma pasada va en el mismo conteo</strong>, y las
              repeticiones entre pantallas se juntan solas.
            </p>

            <form className="inv-anadir" onSubmit={anadirLeido}>
              <input
                ref={campoNombre}
                name="nombre"
                placeholder="Nombre del artículo"
                maxLength={60}
                autoFocus
                aria-label="Nombre"
              />
              <input name="cantidad" placeholder="140x" maxLength={7} aria-label="Cantidad" />
              <button type="submit" className="accion">
                Anotar
              </button>
            </form>

            {filas.length > 0 && (
              <>
                <p className="tun-resumen">
                  {resumen.nuevos} nuevo{resumen.nuevos === 1 ? '' : 's'} · {resumen.cambian}{' '}
                  cambia{resumen.cambian === 1 ? '' : 'n'} · {resumen.iguales} sin cambio
                  {resumen.problemas > 0 && (
                    <em> · {resumen.problemas} con problema, no se guardan</em>
                  )}
                </p>

                <ul className="inv-vista">
                  {filas.map((f, i) => (
                    <li key={`${f.clave ?? 'x'}-${i}`} className={f.estado}>
                      <span className="inv-estado">{ROTULOS[f.estado]}</span>
                      <span className="inv-nombre-vista">
                        {f.nombre || <em>sin nombre</em>}
                        {f.noVisto && <em className="inv-nota"> no salió en el conteo</em>}
                      </span>
                      <span className="inv-cambio">
                        {f.estado === 'cambia' ? (
                          <>
                            {f.antes} → <strong>{f.cantidad}</strong>{' '}
                            <em className={f.diferencia > 0 ? 'sube' : 'baja'}>
                              {f.diferencia > 0 ? '+' : ''}
                              {f.diferencia}
                            </em>
                          </>
                        ) : f.estado === 'discrepa' ? (
                          <>
                            {f.cantidad} contra {f.otra}
                          </>
                        ) : (
                          (f.cantidad ?? '—')
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {/* Declarar un conteo completo es una decisión, no un valor por omisión: si se
                marcara solo, subir media bodega pondría la otra media en cero. */}
            <label className="inv-completo">
              <input
                type="checkbox"
                checked={completo}
                onChange={(e) => setCompleto(e.target.checked)}
              />
              <span>
                Recorrí la bodega <strong>entera</strong> — lo que no anoté está en cero
                {completo && noVistos(articulos, comparar(leidos, articulos)).length > 0 && (
                  <em>
                    {' '}
                    ({noVistos(articulos, comparar(leidos, articulos)).length} artículos irían a 0)
                  </em>
                )}
              </span>
            </label>

            <div className="fila-acciones">
              <button
                type="button"
                className="tun-boton-fuerte"
                disabled={ocupado || !filas.some((f) => f.estado !== 'ilegible' && f.estado !== 'discrepa')}
                onClick={guardarConteo}
              >
                Guardar el conteo
              </button>
              <button
                type="button"
                className="accion"
                onClick={() => {
                  setLeidos(null);
                  setCompleto(false);
                }}
              >
                Cancelar
              </button>
            </div>
          </section>
        )}

        {/* ---------- La bodega ---------- */}
        <div className="tun-buscar">
          <input
            type="search"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            placeholder="Buscar artículo por nombre…"
            aria-label="Buscar artículo por nombre"
          />
          {busqueda && <span className="tun-buscar-cuenta">{vista.length} de {articulos.length}</span>}
        </div>

        {articulos.length === 0 ? (
          <p className="vacio">
            La bodega está vacía. Pulsa «Registrar conteo» y anota lo que hay.
          </p>
        ) : (
          <ul className="inv-lista">
            <li className="inv-fila cabecera">
              <span>Artículo</span>
              <span className="inv-cantidad">Cantidad</span>
              <span className="inv-visto">Visto</span>
              <span />
            </li>
            {vista.map((a) => (
              <Articulo
                key={a.id}
                articulo={a}
                desempate={repetidos.has(a.nombre)}
                onCorregir={corregir}
                onBorrar={borrar}
              />
            ))}
          </ul>
        )}

        {cargas.length > 0 && (
          <section className="bloque">
            <h2 className="ref-titulo">Últimos conteos</h2>
            <ul className="tun-cerrados">
              {cargas.slice(0, 8).map((c) => (
                <li key={c.id}>
                  <strong>{cuando(c.cuando)}</strong>
                  <em>
                    {c.usuario} · {c.nuevos} nuevos, {c.cambiados} cambiados de {c.total}
                  </em>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="pie">
          Un conteo <strong>no borra</strong> lo que no anotaste: la bodega no cabe en una
          pantalla y lo normal es cubrir solo una parte. Lo que lleva días sin verse se nota en la
          columna «Visto». Solo marcando «recorrí la bodega entera» lo no anotado baja a cero, y
          aun así pasa por esta misma tabla antes de guardarse.
        </p>
      </main>
    </>
  );
}
