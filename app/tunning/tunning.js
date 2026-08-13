'use client';

import { useMemo, useRef, useState } from 'react';
import Barra from '../barra';
import useSondeo from '../sondeo';
import { soloHora } from '../../lib/tiempo';
import {
  CATEGORIAS,
  GRUPOS,
  categoria,
  interpretarLista,
  ordenar,
} from '../../lib/tunning-categorias';

const nombreDe = (p) => categoria(p.categoria)?.nombre ?? p.etiqueta;

// Un pedido no lleva patente: se distingue por cuándo se abrió. Los viejos que la tengan
// guardada la siguen mostrando, para no dejar en blanco lo que hasta ayer tenía nombre.
const rotulo = (p) => p?.patente || `Pedido · ${soloHora(p.creado)}`;

/** Una fila de la lista de trabajo. Grande, porque se lee de reojo. */
function Fila({ pieza, siguiente, onMarcar, onQuitar, bloqueado }) {
  return (
    <li className={`tun-fila ${pieza.hecha ? 'hecha' : ''} ${siguiente ? 'siguiente' : ''}`}>
      <button
        type="button"
        className="tun-marca"
        disabled={bloqueado}
        onClick={() => onMarcar(pieza, !pieza.hecha)}
        aria-label={pieza.hecha ? 'Desmarcar' : 'Marcar como hecha'}
      >
        {pieza.hecha ? '✓' : ''}
      </button>
      <span className="tun-categoria">{nombreDe(pieza)}</span>
      <span className="tun-valor">{pieza.valor}</span>
      {onQuitar && (
        <button
          type="button"
          className="tun-quitar"
          disabled={bloqueado}
          onClick={() => onQuitar(pieza)}
          aria-label="Quitar del pedido"
        >
          ×
        </button>
      )}
    </li>
  );
}

export default function Tunning({ usuario, admin, accesos, iniciales, turnoPropio, fallo }) {
  const [pedidos, setPedidos] = useState(iniciales);
  const [turno, setTurno] = useState(turnoPropio);
  const [abiertoId, setAbiertoId] = useState(iniciales.find((p) => !p.cerrado)?.id ?? null);
  const [cat, setCat] = useState('parachoques');
  const [valor, setValor] = useState('');
  const [otra, setOtra] = useState('');
  // 'nuevo' abre un pedido con lo pegado; 'agregar' lo suma al que ya está abierto.
  const [pegando, setPegando] = useState(null);
  const [pegado, setPegado] = useState('');
  const [error, setError] = useState(fallo);
  const [ocupado, setOcupado] = useState(false);
  const campoValor = useRef(null);

  // Marcas mandadas que todavía no volvieron. Mientras haya alguna, el sondeo no pisa la
  // pantalla: traería la lista de antes de la marca y el check saltaría hacia atrás.
  const pendientes = useRef(0);
  const cola = useRef(Promise.resolve());

  const recargar = async () => {
    const r = await fetch('/api/tunning', { cache: 'no-store' });
    const cuerpo = await r.json().catch(() => ({}));
    if (r.ok) setPedidos(cuerpo.pedidos);
  };

  // Dos mecánicos pueden estar con el mismo auto: la lista se pone al día sola.
  useSondeo(() => (pendientes.current ? undefined : recargar()), 15000);

  const pedido = pedidos.find((p) => p.id === abiertoId) ?? null;
  const piezas = pedido?.piezas ?? [];
  const hechas = piezas.filter((p) => p.hecha).length;
  const siguiente = piezas.find((p) => !p.hecha) ?? null;

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
      await recargar();
      return cuerpo;
    } catch {
      setError('Sin conexión con el servidor.');
      return null;
    } finally {
      setOcupado(false);
    }
  };

  const patch = (cambios) =>
    pedir(`/api/tunning/${abiertoId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cambios),
    });

  // ---------- Pegar el pedido entero ----------
  //
  // Se interpreta en el navegador y se enseña **antes** de guardar. Un intérprete que adivina
  // mal en silencio deja el pedido mintiendo, y eso no se nota hasta que el auto sale mal.
  const leidas = useMemo(() => interpretarLista(pegado), [pegado]);
  const buenas = leidas.filter((f) => f.valor);
  const sinNumero = leidas.length - buenas.length;

  const guardarPegado = async () => {
    const entradas = buenas.map((f) => ({
      categoria: f.categoria,
      etiqueta: f.etiqueta,
      valor: f.valor,
    }));

    const r =
      pegando === 'nuevo'
        ? await pedir('/api/tunning', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ piezas: entradas }),
          })
        : await patch({ agregar: entradas });

    if (!r) return;
    if (r.pedido) setAbiertoId(r.pedido.id);
    setPegado('');
    setPegando(null);
  };

  const agregar = (e) => {
    e.preventDefault();
    const limpio = valor.trim();
    if (!limpio) return;

    // El identificador lo pone el navegador y el servidor lo respeta. Así la fila que se acaba
    // de pintar y la que se guarda son la misma pieza, y se puede marcar de inmediato sin
    // esperar a la siguiente lectura.
    const nueva = {
      id: crypto.randomUUID(),
      categoria: cat === 'otra' ? null : cat,
      etiqueta: cat === 'otra' ? otra.trim().slice(0, 40) : null,
      valor: limpio.slice(0, 40),
      hecha: false,
    };

    // Se vacía **antes** de mandar, no al volver la respuesta. Escribiendo una tras otra se
    // teclea la siguiente mientras la anterior viaja, y limpiar al volver borraba lo recién
    // escrito: la pieza se perdía sin decir nada. Pasó en la primera prueba.
    setValor('');
    setOtra('');
    // El foco vuelve al número: se carga el pedido entero sin tocar el mouse.
    campoValor.current?.focus();

    // `ordenar` es la misma del servidor: la fila nace en su sitio y no salta después.
    cambiarPiezas((lista) => ordenar([...lista, nueva]));
    enSegundoPlano({ agregar: nueva }, () => {
      // Si falló, se devuelve lo escrito — salvo que ya se esté escribiendo otra cosa.
      setValor((v) => v || nueva.valor);
      setOtra((v) => v || nueva.etiqueta || '');
    });
  };

  // ---------- Marcar y quitar: al instante ----------
  //
  // Antes cada check esperaba **dos** idas al servidor —la que guardaba y la que recargaba la
  // lista entera— y encima dejaba toda la pantalla deshabilitada mientras tanto. Marcando
  // treinta piezas eso se siente pegado, y es lo único que se hace en esta pantalla.
  //
  // Ahora se pinta de inmediato y la escritura va por detrás. El servidor sigue mandando: si
  // falla, se vuelve a leer y la lista queda como esté allá, con el aviso.
  const cambiarPiezas = (hacer) =>
    setPedidos((antes) =>
      antes.map((p) => (p.id === abiertoId ? { ...p, piezas: hacer(p.piezas) } : p))
    );

  /**
   * Manda un cambio sin bloquear la pantalla, y **de a uno**.
   *
   * En cola y no en paralelo porque cada escritura lee y reescribe la colección entera: dos a
   * la vez se pisan y una de las dos marcas se pierde. Marcando rápido eso pasa siempre.
   */
  const enSegundoPlano = (cambios, alFallar) => {
    pendientes.current += 1;

    const tarea = async () => {
      try {
        const r = await fetch(`/api/tunning/${abiertoId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cambios),
        });
        if (r.ok) return;
        const cuerpo = await r.json().catch(() => ({}));
        setError(cuerpo.error || 'No se pudo guardar.');
      } catch {
        setError('Sin conexión con el servidor.');
      }
      alFallar?.();
      await recargar().catch(() => {});
    };

    // `then(tarea, tarea)` y no `then(tarea)`: si una se cayera, la cola quedaría rota y las
    // siguientes marcas no se mandarían nunca.
    cola.current = cola.current.then(tarea, tarea).finally(() => {
      pendientes.current -= 1;
    });
  };

  const marcar = (pieza, hecha) => {
    cambiarPiezas((lista) => lista.map((x) => (x.id === pieza.id ? { ...x, hecha } : x)));
    enSegundoPlano({ pieza: pieza.id, hecha });
  };

  const quitar = (pieza) => {
    cambiarPiezas((lista) => lista.filter((x) => x.id !== pieza.id));
    enSegundoPlano({ quitar: pieza.id });
  };

  const porGrupo = useMemo(() => {
    const grupos = new Map();
    for (const p of piezas) {
      const g = categoria(p.categoria)?.grupo ?? 'Otras';
      if (!grupos.has(g)) grupos.set(g, []);
      grupos.get(g).push(p);
    }
    return [...grupos.entries()];
  }, [piezas]);

  const abiertos = pedidos.filter((p) => !p.cerrado);
  // Un pedido ya no se cierra: se trabaja y se elimina. Esto queda solo para los que quedaron
  // cerrados con la versión anterior — si no, no habría forma de volver a verlos ni de sacarlos.
  const cerrados = pedidos.filter((p) => p.cerrado);

  return (
    <>
      <Barra
        usuario={usuario}
        admin={admin}
        accesos={accesos}
        seccion="tunning"
        turno={turno}
        onTurnoCambio={setTurno}
      />

      <main className="envoltura">
        <header className="titulo">
          <div>
            <h1 className="titulo-texto">Tunning</h1>
            <p className="titulo-bajada">La lista de piezas, ordenada como el menú del juego</p>
          </div>
          <button
            type="button"
            className="accion"
            disabled={ocupado}
            onClick={() => {
              setPegando('nuevo');
              setPegado('');
            }}
          >
            Nuevo pedido
          </button>
        </header>

        {error && <p className="panel-error">{error}</p>}

        {/* ---------- Pegar la lista de una vez ---------- */}
        {pegando && (
          <section className="tun-pegar">
            <h2 className="ref-titulo">
              {pegando === 'nuevo' ? 'Pega el pedido' : 'Pega más piezas'}
            </h2>
            <p className="tun-ayuda">
              Una pieza por línea, tal como la canta la tablet. Da igual el formato:{' '}
              <code>Parachoques delantero: 4</code>, <code>Techo 4</code> o <code>- Llantas 12</code>.
            </p>

            <textarea
              className="tun-textarea"
              value={pegado}
              onChange={(e) => setPegado(e.target.value)}
              rows={10}
              spellCheck={false}
              autoFocus
              placeholder={'Color primario: METÁLICO - RGB(84,118,204)\nParachoques delantero: 4\nLlantas 12\nTinte de ventanas 3'}
            />

            {leidas.length > 0 && (
              <>
                <p className="tun-resumen">
                  {buenas.length} pieza{buenas.length === 1 ? '' : 's'} reconocida
                  {buenas.length === 1 ? '' : 's'}
                  {/* Decir «1 sin número» y no cuál obliga a ir a buscarla, y la lista de la
                      vista previa lleva su propio scroll: puede estar fuera de la vista. */}
                  {sinNumero > 0 && (
                    <em>
                      {' '}
                      · {sinNumero} sin número, {sinNumero === 1 ? 'queda' : 'quedan'} fuera:{' '}
                      {leidas
                        .filter((f) => !f.valor)
                        .slice(0, 4)
                        .map((f) => categoria(f.categoria)?.nombre ?? f.etiqueta)
                        .join(', ')}
                      {sinNumero > 4 ? '…' : ''}
                    </em>
                  )}
                </p>
                <ul className="tun-vista">
                  {leidas.map((f, i) => (
                    <li key={i} className={f.valor ? '' : 'falta'}>
                      <span className={f.categoria ? '' : 'propia'}>
                        {categoria(f.categoria)?.nombre ?? f.etiqueta}
                      </span>
                      <span>{f.valor || 'sin número'}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}

            <div className="fila-acciones">
              <button
                type="button"
                className="tun-boton-pegar"
                disabled={ocupado || (pegando === 'agregar' && !buenas.length)}
                onClick={guardarPegado}
              >
                {buenas.length
                  ? `Guardar ${buenas.length} pieza${buenas.length === 1 ? '' : 's'}`
                  : 'Abrir el pedido vacío'}
              </button>
              <button
                type="button"
                className="accion"
                onClick={() => {
                  setPegando(null);
                  setPegado('');
                }}
              >
                Cancelar
              </button>
            </div>
          </section>
        )}

        {abiertos.length > 1 && (
          <div className="tun-pestanas">
            {abiertos.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`tun-pestana ${p.id === abiertoId ? 'activa' : ''}`}
                onClick={() => setAbiertoId(p.id)}
              >
                {rotulo(p)}
                <em>
                  {p.piezas.filter((x) => x.hecha).length}/{p.piezas.length}
                </em>
              </button>
            ))}
          </div>
        )}

        {!pedido ? (
          !pegando && (
            <p className="vacio">
              {abiertos.length === 0
                ? 'No hay pedidos abiertos. Pulsa «Nuevo pedido» y pega la lista.'
                : 'Elige un pedido.'}
            </p>
          )
        ) : (
          <section className="tun-lista">
            <div className="tun-cabeza">
              <h2 className="ref-titulo">
                {rotulo(pedido)} <span className="doc-cuenta">{hechas}/{piezas.length}</span>
              </h2>
              <span className="fila-acciones">
                <button
                  type="button"
                  className="tun-boton-pegar"
                  disabled={ocupado}
                  onClick={() => {
                    setPegando('agregar');
                    setPegado('');
                  }}
                >
                  📋 Pegar lista
                </button>
                <button
                  type="button"
                  className="accion peligro"
                  disabled={ocupado}
                  onClick={() => {
                    if (!window.confirm('¿Eliminar este pedido?')) return;
                    pedir(`/api/tunning/${pedido.id}`, { method: 'DELETE' }).then(() =>
                      setAbiertoId(null)
                    );
                  }}
                >
                  Eliminar
                </button>
              </span>
            </div>

            <form className="tun-agregar" onSubmit={agregar}>
              <select value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Categoría">
                {GRUPOS.map((g) => (
                  <optgroup key={g} label={g}>
                    {CATEGORIAS.filter((c) => c.grupo === g).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre}
                      </option>
                    ))}
                  </optgroup>
                ))}
                <option value="otra">Otra…</option>
              </select>

              {cat === 'otra' && (
                <input
                  value={otra}
                  onChange={(e) => setOtra(e.target.value)}
                  placeholder="Cuál es"
                  maxLength={40}
                  required
                />
              )}

              <input
                ref={campoValor}
                className="tun-numero"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder={categoria(cat)?.texto ? 'metálico RGB(84,118,204)' : 'nº'}
                maxLength={40}
                required
              />

              <button type="submit" className="accion" disabled={ocupado}>
                Añadir
              </button>
            </form>

            {piezas.length === 0 ? (
              <p className="vacio">
                Pega la lista del pedido, o añade las piezas de a una con el formulario de
                arriba.
              </p>
            ) : (
              porGrupo.map(([grupo, lista]) => (
                <div className="tun-grupo" key={grupo}>
                  <h3 className="tun-grupo-titulo">{grupo}</h3>
                  <ul className="tun-filas">
                    {lista.map((p) => (
                      /* Sin `bloqueado`: deshabilitar la lista mientras viaja una marca es
                         justo lo que la hacía sentirse lenta. */
                      <Fila
                        key={p.id}
                        pieza={p}
                        siguiente={siguiente?.id === p.id}
                        onMarcar={marcar}
                        onQuitar={quitar}
                      />
                    ))}
                  </ul>
                </div>
              ))
            )}
          </section>
        )}

        {cerrados.length > 0 && (
          <section className="bloque">
            <h2 className="ref-titulo">Cerrados</h2>
            <ul className="tun-cerrados">
              {cerrados.slice(0, 8).map((p) => (
                <li key={p.id}>
                  <strong>{rotulo(p)}</strong>
                  <em>{p.piezas.length} piezas · {p.creadoPor}</em>
                  <button
                    type="button"
                    className="accion"
                    disabled={ocupado}
                    onClick={() => {
                      setAbiertoId(p.id);
                      pedir(`/api/tunning/${p.id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ cerrado: false }),
                      });
                    }}
                  >
                    Reabrir
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="pie">
          La lista se ordena como el menú del juego, no como llega el pedido: se baja una vez
          por sección y no hay que volver atrás. Se marca cada pieza al instalarla; volver a
          pulsar la desmarca.
        </p>
      </main>
    </>
  );
}
