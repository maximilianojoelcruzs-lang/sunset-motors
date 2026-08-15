'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Barra from '../barra';
import useSondeo from '../sondeo';
import { soloFecha, soloHora } from '../../lib/tiempo';
import { casanNombres, comparar, noVistos, pesosParecidos } from '../../lib/inventario-lectura';

const sinTildes = (texto) =>
  String(texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const peso = (kg) =>
  kg == null ? '—' : kg < 1 ? `${Math.round(kg * 1000)} g` : `${kg.toFixed(2)} kg`;

/** El peso de una fila leída viene como texto («28.00kg»); acá se necesita el número. */
const normalizarPesoTexto = (valor) => {
  if (valor == null) return null;
  const texto = String(valor).toLowerCase().replace(',', '.');
  const n = Number(texto.replace(/[^\d.]/g, ''));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round((!texto.includes('kg') && texto.includes('g') ? n / 1000 : n) * 100) / 100;
};

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
  const [leyendo, setLeyendo] = useState('');
  // Cuántas casillas trajo cada captura. Se enseña porque es el número que permite darse
  // cuenta al instante de que algo salió mal: la rejilla se ve y se cuenta.
  const [capturas, setCapturas] = useState([]);
  // Nombres completos propuestos para los que el juego enseña cortados. Sugerencias: no se
  // guarda ninguno hasta que alguien pulsa.
  const [sugerencias, setSugerencias] = useState(null);
  const [sugiriendo, setSugiriendo] = useState(false);
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

  /**
   * Sube las capturas y suma lo que se lee al conteo en curso.
   *
   * Una por una y no todas juntas: la bodega necesita varias pantallas, y así se ve el avance
   * («2 de 4») en vez de quedarse mirando un botón muerto medio minuto. Lo leído **no se
   * guarda**: cae en la misma tabla de confirmación que lo anotado a mano.
   */
  const escanear = async (e) => {
    const imagenes = [...e.target.files];
    e.target.value = '';
    if (!imagenes.length) return;

    setError('');
    for (const [i, imagen] of imagenes.entries()) {
      setLeyendo(`Leyendo ${i + 1} de ${imagenes.length}…`);
      const datos = new FormData();
      datos.append('imagen', imagen);
      try {
        const r = await fetch('/api/inventario/leer', { method: 'POST', body: datos });
        const cuerpo = await r.json().catch(() => ({}));
        if (!r.ok) {
          setError(`${imagen.name}: ${cuerpo.error || 'no se pudo leer.'}`);
          continue;
        }
        setLeidos((antes) => [...(antes ?? []), ...cuerpo.filas]);
        setCapturas((antes) => [
          ...antes,
          { nombre: imagen.name, casillas: cuerpo.filas.length, repetidas: cuerpo.repetidas ?? 0 },
        ]);
      } catch {
        setError('Sin conexión con el servidor.');
        break;
      }
    }
    setLeyendo('');
  };

  /**
   * Resuelve una contradicción: el lector leyó la misma tarjeta dos veces con números
   * distintos («140» y «40»), y se elige cuál vale.
   *
   * Sin esto la fila quedaba marcada y simplemente no se guardaba, y había que anotarla a mano.
   * Adivinar cuál de los dos es el bueno no se puede —por eso no se elige solo—, pero preguntar
   * cuesta un clic.
   */
  const resolver = (fila, cantidad) =>
    setLeidos((antes) =>
      antes.map((l) =>
        casanNombres(l.nombre, fila.nombre) && pesosParecidos(normalizarPesoTexto(l.peso), fila.peso)
          ? { ...l, cantidad }
          : l
      )
    );

  const guardarConteo = async () => {
    const r = await pedir('/api/inventario', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filas }),
    });
    if (!r) return;
    setLeidos(null);
    setCompleto(false);
    setCapturas([]);
    await recargar();
  };

  // ---------- Completar los nombres cortados ----------
  //
  // Se pide **una vez**, no en cada escaneo: si el lector completara los nombres al leer, dos
  // capturas de lo mismo darían nombres distintos y volverían los duplicados. Como el casado es
  // por prefijo, un nombre completo guardado sigue reconociendo las capturas cortadas.
  const pedirNombres = async () => {
    setSugiriendo(true);
    setError('');
    const r = await pedir('/api/inventario/nombres', { method: 'POST' });
    setSugiriendo(false);
    if (r) setSugerencias(r.sugerencias.map((s) => ({ ...s, elegido: s.completo })));
  };

  const guardarNombres = async () => {
    const cambios = sugerencias
      .filter((s) => s.elegido && s.elegido !== s.actual)
      .map((s) => ({ id: s.id, nombre: s.elegido }));
    if (!cambios.length) return setSugerencias(null);

    const r = await pedir('/api/inventario/nombres', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cambios }),
    });
    if (r) setSugerencias(null);
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
  const cortados = articulos.filter((a) => /(\.{2,}|…)\s*$/.test(a.nombre)).length;

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
            <span className="fila-acciones">
              {cortados > 0 && !sugerencias && (
                <button type="button" className="accion" disabled={sugiriendo} onClick={pedirNombres}>
                  {sugiriendo ? 'Pensando…' : `Completar ${cortados} nombre${cortados === 1 ? '' : 's'} cortado${cortados === 1 ? '' : 's'}`}
                </button>
              )}
              <button
                type="button"
                className="tun-boton-fuerte"
                disabled={ocupado}
                onClick={() => setLeidos([])}
              >
                Registrar conteo
              </button>
            </span>
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

            <div className="inv-capturas">
              <label className="tun-boton-fuerte inv-subir">
                📷 Subir capturas
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  multiple
                  onChange={escanear}
                  disabled={Boolean(leyendo)}
                />
              </label>
              <span className="inv-leyendo">
                {leyendo || 'Sube todas las pantallas de una misma pasada; el solape se junta solo.'}
              </span>
            </div>

            {/* Cuenta las casillas de la rejilla en la foto y compáralo con esto: es la forma
                más rápida de ver que el lector se dejó algo o leyó de más. */}
            {capturas.length > 0 && (
              <ul className="inv-capturas-leidas">
                {capturas.map((c, i) => (
                  <li key={i}>
                    <strong>{c.nombre}</strong> · {c.casillas} casillas leídas
                    {c.repetidas > 0 && <em> · {c.repetidas} repetidas descartadas</em>}
                  </li>
                ))}
              </ul>
            )}

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
                          <span className="inv-elegir">
                            <button type="button" onClick={() => resolver(f, f.cantidad)}>
                              {f.cantidad}
                            </button>
                            <em>o</em>
                            <button type="button" onClick={() => resolver(f, f.otra)}>
                              {f.otra}
                            </button>
                          </span>
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
                  setCapturas([]);
                }}
              >
                Cancelar
              </button>
            </div>
          </section>
        )}

        {/* ---------- Nombres completos propuestos ---------- */}
        {sugerencias && (
          <section className="inv-conteo">
            <h2 className="ref-titulo">Nombres completos</h2>
            <p className="tun-ayuda">
              El juego corta los nombres largos en su propia pantalla, así que esas letras no
              están en la foto: esto es una <strong>deducción</strong>, no una lectura. Revísala
              —lo marcado con <em>(?)</em> es donde había más de una opción— y corrige lo que
              haga falta antes de guardar.
            </p>

            <ul className="inv-vista">
              {sugerencias.map((s, i) => (
                <li key={s.id} className={s.seguro ? '' : 'discrepa'}>
                  <span className="inv-estado">{s.seguro ? 'claro' : '(?) dudoso'}</span>
                  <span className="inv-nombre-vista">
                    {s.actual}
                    {/* Dos artículos pueden tener el mismo texto cortado —los dos kits— y
                        recibir la misma propuesta. Sin esto no habría forma de saber cuál se
                        está corrigiendo. */}
                    <em className="inv-nota">
                      {' '}
                      {peso(s.peso)} · {s.cantidad} unidades
                    </em>
                  </span>
                  <input
                    className="inv-nombre"
                    value={s.elegido}
                    onChange={(e) =>
                      setSugerencias((antes) =>
                        antes.map((x, j) => (j === i ? { ...x, elegido: e.target.value } : x))
                      )
                    }
                    maxLength={60}
                    aria-label={`Nombre completo de ${s.actual}`}
                  />
                </li>
              ))}
            </ul>

            <div className="fila-acciones">
              <button
                type="button"
                className="tun-boton-fuerte"
                disabled={ocupado}
                onClick={guardarNombres}
              >
                Guardar los nombres
              </button>
              <button type="button" className="accion" onClick={() => setSugerencias(null)}>
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
