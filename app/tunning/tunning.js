'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Barra from '../barra';
import useSondeo from '../sondeo';
import useVoz, { comoSeDice } from './voz';
import { soloHora } from '../../lib/tiempo';
import {
  CATEGORIAS,
  GRUPOS,
  categoria,
  interpretarLista,
} from '../../lib/tunning-categorias';

const nombreDe = (p) => categoria(p.categoria)?.nombre ?? p.etiqueta;
const esTexto = (p) => Boolean(categoria(p.categoria)?.texto);

// Un pedido ya no lleva patente: se distingue por cuándo se abrió. Los viejos que la tengan
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
  const [modoTrabajo, setModoTrabajo] = useState(false);
  const [error, setError] = useState(fallo);
  const [ocupado, setOcupado] = useState(false);
  const campoValor = useRef(null);

  const { encendida, disponible, alternar, decir } = useVoz();

  const recargar = async () => {
    const r = await fetch('/api/tunning', { cache: 'no-store' });
    const cuerpo = await r.json().catch(() => ({}));
    if (r.ok) setPedidos(cuerpo.pedidos);
  };

  // Dos mecánicos pueden estar con el mismo auto: la lista se pone al día sola.
  useSondeo(recargar, 15000);

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

  const agregar = async (e) => {
    e.preventDefault();
    const enviar = { categoria: cat === 'otra' ? null : cat, etiqueta: otra, valor };

    // Se vacía **antes** de mandar, no al volver la respuesta. Escribiendo una tras otra se
    // teclea la siguiente mientras la anterior viaja, y limpiar al volver borraba lo recién
    // escrito: la pieza se perdía sin decir nada. Pasó en la primera prueba.
    setValor('');
    setOtra('');
    // El foco vuelve al número: se carga el pedido entero sin tocar el mouse.
    campoValor.current?.focus();

    const r = await patch({ agregar: enviar });
    // Si falló, se devuelve lo escrito — salvo que ya se esté escribiendo otra cosa.
    if (!r) {
      setValor((v) => v || enviar.valor);
      setOtra((v) => v || enviar.etiqueta);
    }
  };

  /** Marca y canta la que viene. Lo que se oye es la lista ya ordenada, no la del pedido. */
  const marcar = async (pieza, hecha) => {
    const r = await patch({ pieza: pieza.id, hecha });
    if (!r?.pedido || !hecha) return;

    const queda = r.pedido.piezas.find((p) => !p.hecha);
    decir(
      queda
        ? comoSeDice(nombreDe(queda), queda.valor, esTexto(queda))
        : 'Listo. El pedido está terminado.'
    );
  };

  // Al entrar en modo trabajo se canta la pieza en la que se quedó.
  useEffect(() => {
    if (modoTrabajo && siguiente) {
      decir(comoSeDice(nombreDe(siguiente), siguiente.valor, esTexto(siguiente)));
    }
    // Solo al encender el modo, no en cada pieza: de eso ya se encarga `marcar`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modoTrabajo]);

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
          <span className="fila-acciones">
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
            {disponible && (
              <button
                type="button"
                className={`accion ${encendida ? 'destacada' : ''}`}
                onClick={alternar}
                title="Canta en voz alta la pieza que viene"
              >
                {encendida ? '🔊 Voz encendida' : '🔇 Voz apagada'}
              </button>
            )}
          </span>
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
                className="accion destacada"
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
        ) : modoTrabajo ? (
          /* ---------- Modo trabajo: una sola pieza, enorme ---------- */
          <section className="tun-trabajo">
            <div className="tun-progreso">
              <span>
                {hechas} de {piezas.length}
              </span>
              <span className="tun-barra" aria-hidden="true">
                <span style={{ width: `${piezas.length ? (hechas / piezas.length) * 100 : 0}%` }} />
              </span>
            </div>

            {siguiente ? (
              <>
                <p className="tun-grande-rotulo">{categoria(siguiente.categoria)?.grupo ?? 'Otras'}</p>
                <h2 className="tun-grande-categoria">{nombreDe(siguiente)}</h2>
                <p className={`tun-grande-valor ${esTexto(siguiente) ? 'texto' : ''}`}>
                  {siguiente.valor}
                </p>

                <button
                  type="button"
                  className="tun-hecha"
                  disabled={ocupado}
                  onClick={() => marcar(siguiente, true)}
                >
                  Hecha · siguiente
                </button>
              </>
            ) : (
              <>
                <h2 className="tun-grande-categoria">Terminado</h2>
                <p className="tun-grande-rotulo">Las {piezas.length} piezas están instaladas</p>
                <button
                  type="button"
                  className="tun-hecha"
                  disabled={ocupado}
                  onClick={() => patch({ cerrado: true })}
                >
                  Cerrar el pedido
                </button>
              </>
            )}

            <button type="button" className="accion" onClick={() => setModoTrabajo(false)}>
              Ver la lista completa
            </button>
          </section>
        ) : (
          /* ---------- Lista completa ---------- */
          <section className="tun-lista">
            <div className="tun-cabeza">
              <h2 className="ref-titulo">
                {rotulo(pedido)} <span className="doc-cuenta">{hechas}/{piezas.length}</span>
              </h2>
              <span className="fila-acciones">
                {piezas.length > 0 && (
                  <button
                    type="button"
                    className="accion destacada"
                    onClick={() => setModoTrabajo(true)}
                  >
                    Modo trabajo
                  </button>
                )}
                <button
                  type="button"
                  className="accion"
                  onClick={() => {
                    setPegando('agregar');
                    setPegado('');
                  }}
                >
                  Pegar lista
                </button>
                <button
                  type="button"
                  className="accion"
                  disabled={ocupado}
                  onClick={() => patch({ cerrado: true })}
                >
                  Cerrar
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
                      <Fila
                        key={p.id}
                        pieza={p}
                        siguiente={siguiente?.id === p.id}
                        bloqueado={ocupado}
                        onMarcar={marcar}
                        onQuitar={(x) => patch({ quitar: x.id })}
                      />
                    ))}
                  </ul>
                </div>
              ))
            )}
          </section>
        )}

        {cerrados.length > 0 && !modoTrabajo && (
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
          por sección y no hay que volver atrás. Con la voz encendida, al marcar una pieza se
          canta la siguiente y no hace falta mirar la pantalla.
        </p>
      </main>
    </>
  );
}
