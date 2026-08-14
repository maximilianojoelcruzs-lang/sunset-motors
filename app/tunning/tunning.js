'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Barra from '../barra';
import useSondeo from '../sondeo';
import { soloHora } from '../../lib/tiempo';
import { CATEGORIAS, GRUPOS, categoria, interpretarLista } from '../../lib/tunning-categorias';

// Un pedido no lleva patente: se distingue por cuándo se abrió. Los viejos que la tengan
// guardada la siguen mostrando, para no dejar en blanco lo que hasta ayer tenía nombre.
const rotulo = (p) => p?.patente || `Pedido · ${soloHora(p.creado)}`;

// Una categoría vale una sola vez, igual que en el menú del juego: no hay dos techos. Esta es
// la misma clave que usa el servidor para decidir si una línea suma o actualiza.
const claveDe = (p) => p.categoria ?? `otra:${String(p.etiqueta ?? '').toLowerCase()}`;

/**
 * Una fila del catálogo: el nombre fijo y una casilla para el valor.
 *
 * La casilla es lo único que se escribe. Antes había que elegir la categoría en un desplegable
 * y pulsar «Añadir» pieza por pieza; con treinta piezas eso son noventa gestos. Acá está todo
 * el menú a la vista y solo se rellena lo que el pedido trae.
 */
function Fila({ fila, valor, siguiente, onEscribir, onCerrar, onMarcar }) {
  const puesta = Boolean(fila.pieza);
  const hecha = Boolean(fila.pieza?.hecha);

  return (
    <li
      className={`tun-fila ${puesta ? 'puesta' : 'vacia'} ${hecha ? 'hecha' : ''} ${
        siguiente ? 'siguiente' : ''
      } ${fila.texto ? 'texto' : ''}`}
    >
      {puesta ? (
        <button
          type="button"
          className="tun-marca"
          onClick={() => onMarcar(fila.pieza, !hecha)}
          aria-label={hecha ? 'Desmarcar' : 'Marcar como instalada'}
        >
          {hecha ? '✓' : ''}
        </button>
      ) : (
        <span className="tun-marca-hueco" aria-hidden="true" />
      )}

      <span className="tun-categoria">{fila.nombre}</span>

      <input
        className={`tun-campo ${fila.texto ? 'ancho' : ''}`}
        value={valor}
        onChange={(e) => onEscribir(fila, e.target.value)}
        onBlur={() => onCerrar(fila)}
        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), e.target.blur())}
        placeholder={fila.texto ? 'color' : 'nº'}
        maxLength={40}
        spellCheck={false}
        title={valor || undefined}
        aria-label={`Valor de ${fila.nombre}`}
      />
    </li>
  );
}

export default function Tunning({ usuario, admin, accesos, iniciales, turnoPropio, fallo }) {
  const [pedidos, setPedidos] = useState(iniciales);
  const [turno, setTurno] = useState(turnoPropio);
  const [abiertoId, setAbiertoId] = useState(iniciales.find((p) => !p.cerrado)?.id ?? null);
  // 'nuevo' abre un pedido con lo pegado; 'agregar' lo suma al que ya está abierto.
  const [pegando, setPegando] = useState(null);
  const [pegado, setPegado] = useState('');
  // Lo que se está tecleando ahora mismo, por fila. Mientras hay borrador manda él: si no, la
  // respuesta del servidor pisaría el campo justo mientras alguien escribe dentro.
  const [borradores, setBorradores] = useState({});
  const [error, setError] = useState(fallo);
  const [ocupado, setOcupado] = useState(false);

  const relojes = useRef({});
  const pendientes = useRef(0);
  const cola = useRef(Promise.resolve());

  const recargar = async () => {
    const r = await fetch('/api/tunning', { cache: 'no-store' });
    const cuerpo = await r.json().catch(() => ({}));
    if (r.ok) setPedidos(cuerpo.pedidos);
  };

  // Dos mecánicos pueden estar con el mismo auto: la lista se pone al día sola.
  useSondeo(() => (pendientes.current ? undefined : recargar()), 15000);

  // Los temporizadores de escritura no pueden sobrevivir a la pantalla.
  useEffect(() => () => Object.values(relojes.current).forEach(clearTimeout), []);

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

  // ---------- Escrituras: la pantalla primero, el servidor por detrás ----------
  const cambiarPiezas = (hacer) =>
    setPedidos((antes) =>
      antes.map((p) => (p.id === abiertoId ? { ...p, piezas: hacer(p.piezas) } : p))
    );

  /**
   * Manda un cambio sin bloquear la pantalla, y **de a uno**.
   *
   * En cola y no en paralelo porque cada escritura lee y reescribe la colección entera: dos a
   * la vez se pisan y una de las dos se pierde. Escribiendo rápido eso pasa siempre.
   */
  const enSegundoPlano = (cambios) => {
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
      await recargar().catch(() => {});
    };

    // `then(tarea, tarea)` y no `then(tarea)`: si una se cayera, la cola quedaría rota y los
    // cambios siguientes no se mandarían nunca.
    cola.current = cola.current.then(tarea, tarea).finally(() => {
      pendientes.current -= 1;
    });
  };

  const marcar = (pieza, hecha) => {
    cambiarPiezas((lista) => lista.map((x) => (x.id === pieza.id ? { ...x, hecha } : x)));
    enSegundoPlano({ pieza: pieza.id, hecha });
  };

  // ---------- Escribir el valor de una fila ----------
  //
  // Se manda al parar de teclear, no en cada tecla: escribiendo «12» son dos escrituras
  // completas de la colección para un solo número.
  const guardar = (fila, texto) => {
    clearTimeout(relojes.current[fila.clave]);
    setBorradores((b) => {
      const copia = { ...b };
      delete copia[fila.clave];
      return copia;
    });

    const limpio = texto.trim().slice(0, 40);
    const antes = fila.pieza;
    if (limpio === (antes?.valor ?? '')) return;

    if (!limpio) {
      cambiarPiezas((lista) => lista.filter((x) => x.id !== antes.id));
      enSegundoPlano({ quitar: antes.id });
      return;
    }

    if (antes) {
      cambiarPiezas((lista) =>
        lista.map((x) => (x.id === antes.id ? { ...x, valor: limpio } : x))
      );
      // Por categoría, no por id: el servidor reconoce que ya estaba y le cambia el valor
      // conservando el id y si estaba instalada.
      enSegundoPlano({ agregar: { ...fila.entrada, valor: limpio } });
      return;
    }

    // El identificador lo pone el navegador y el servidor lo respeta, para que la fila pintada
    // y la guardada sean la misma pieza y se pueda marcar sin esperar a la siguiente lectura.
    const nueva = { id: crypto.randomUUID(), ...fila.entrada, valor: limpio, hecha: false };
    cambiarPiezas((lista) => [...lista, nueva]);
    enSegundoPlano({ agregar: nueva });
  };

  const escribir = (fila, texto) => {
    setBorradores((b) => ({ ...b, [fila.clave]: texto }));
    clearTimeout(relojes.current[fila.clave]);
    relojes.current[fila.clave] = setTimeout(() => guardar(fila, texto), 500);
  };

  // Al salir del campo se manda ya, sin esperar el medio segundo.
  const cerrar = (fila) => {
    const texto = borradores[fila.clave];
    if (texto !== undefined) guardar(fila, texto);
  };

  // ---------- Pegar el pedido entero ----------
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
        : await pedir(`/api/tunning/${abiertoId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ agregar: entradas }),
          });

    if (!r) return;
    if (r.pedido) setAbiertoId(r.pedido.id);
    setPegado('');
    setPegando(null);
  };

  // ---------- Las filas: el menú entero, siempre ----------
  //
  // Se ve el catálogo completo aunque el pedido traiga tres piezas. Así se rellena leyendo la
  // tablet de arriba abajo, sin buscar cada categoría en un desplegable.
  const filas = useMemo(() => {
    const puestas = new Map(piezas.map((p) => [claveDe(p), p]));

    const delCatalogo = CATEGORIAS.map((c) => ({
      clave: c.id,
      nombre: c.nombre,
      grupo: c.grupo,
      texto: Boolean(c.texto),
      entrada: { categoria: c.id, etiqueta: null },
      pieza: puestas.get(c.id) ?? null,
    }));

    // Lo que llegó pegado y no se reconoció no se esconde: va al final, con su nombre. Y si el
    // almacén trae una categoría que el catálogo ya no tiene, se muestra por su identificador
    // en vez de dejar la fila sin nombre.
    const propias = piezas
      .filter((p) => !categoria(p.categoria))
      .map((p) => ({
        clave: claveDe(p),
        nombre: p.etiqueta ?? p.categoria,
        grupo: 'Otras',
        texto: true,
        entrada: { categoria: p.categoria, etiqueta: p.etiqueta },
        pieza: p,
      }));

    return [...delCatalogo, ...propias];
  }, [piezas]);

  const porGrupo = useMemo(() => {
    const grupos = new Map([...GRUPOS, 'Otras'].map((g) => [g, []]));
    for (const f of filas) grupos.get(f.grupo)?.push(f);
    return [...grupos.entries()].filter(([, lista]) => lista.length);
  }, [filas]);

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
            <p className="titulo-bajada">El menú entero: solo se rellena lo que trae el pedido</p>
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
                ? 'No hay pedidos abiertos. Pulsa «Nuevo pedido».'
                : 'Elige un pedido.'}
            </p>
          )
        ) : (
          <section className="tun-lista">
            <div className="tun-cabeza">
              <h2 className="ref-titulo">
                {rotulo(pedido)}{' '}
                <span className="doc-cuenta">
                  {hechas}/{piezas.length}
                </span>
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

            {porGrupo.map(([grupo, lista]) => (
              <div className="tun-grupo" key={grupo}>
                <h3 className="tun-grupo-titulo">{grupo}</h3>
                <ul className="tun-filas">
                  {lista.map((f) => (
                    <Fila
                      key={f.clave}
                      fila={f}
                      valor={borradores[f.clave] ?? f.pieza?.valor ?? ''}
                      siguiente={Boolean(f.pieza) && siguiente?.id === f.pieza.id}
                      onEscribir={escribir}
                      onCerrar={cerrar}
                      onMarcar={marcar}
                    />
                  ))}
                </ul>
              </div>
            ))}
          </section>
        )}

        {cerrados.length > 0 && (
          <section className="bloque">
            <h2 className="ref-titulo">Cerrados</h2>
            <ul className="tun-cerrados">
              {cerrados.slice(0, 8).map((p) => (
                <li key={p.id}>
                  <strong>{rotulo(p)}</strong>
                  <em>
                    {p.piezas.length} piezas · {p.creadoPor}
                  </em>
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
          Está el menú completo, en el mismo orden que en el juego: se baja una vez por sección
          rellenando lo que el pedido trae y las demás quedan en blanco. Vaciar una casilla la
          saca del pedido. Se marca cada pieza al instalarla; volver a pulsar la desmarca.
        </p>
      </main>
    </>
  );
}
