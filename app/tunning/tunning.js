'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Barra from '../barra';
import useSondeo from '../sondeo';
import { soloHora } from '../../lib/tiempo';
import { CATEGORIAS, GRUPOS, categoria } from '../../lib/tunning-categorias';

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
function Fila({ fila, valor, siguiente, onEscribir, onCerrar, onMarcar, onQuitar }) {
  const puesta = Boolean(fila.pieza);
  const hecha = Boolean(fila.pieza?.hecha);

  return (
    <li
      className={`tun-fila ${puesta ? 'puesta' : 'vacia'} ${hecha ? 'hecha' : ''} ${
        siguiente ? 'siguiente' : ''
      } ${fila.texto ? 'texto' : ''} ${fila.propia ? 'propia' : ''}`}
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
        placeholder={fila.propia ? 'opcional' : fila.texto ? 'color' : 'nº'}
        maxLength={40}
        spellCheck={false}
        title={valor || undefined}
        aria-label={`Valor de ${fila.nombre}`}
      />

      {/* Las escritas a mano se borran con la equis: vaciar la casilla no puede sacarlas,
          porque una línea de texto suelta —«falta pieza»— no lleva valor y seguiría siendo
          válida. Las del catálogo sí desaparecen al vaciar el número. */}
      {fila.propia && (
        <button
          type="button"
          className="tun-quitar"
          onClick={() => onQuitar(fila.pieza)}
          aria-label={`Quitar ${fila.nombre}`}
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
  // Lo que se está tecleando ahora mismo, por fila. Mientras hay borrador manda él: si no, la
  // respuesta del servidor pisaría el campo justo mientras alguien escribe dentro.
  const [borradores, setBorradores] = useState({});
  // Qué secciones están desplegadas. Un `Set`, igual que en la calculadora.
  const [abiertas, setAbiertas] = useState(new Set());
  // La línea escrita a mano que se está redactando.
  const [nombreNuevo, setNombreNuevo] = useState('');
  const [valorNuevo, setValorNuevo] = useState('');
  const [error, setError] = useState(fallo);
  const [ocupado, setOcupado] = useState(false);

  const relojes = useRef({});
  const campoNuevo = useRef(null);
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

    // Vaciar el número saca la pieza del pedido… salvo en las escritas a mano, donde el valor
    // es opcional: «falta pieza» sin nada al lado sigue siendo un recado válido. Esas se
    // quitan con la equis.
    if (!limpio && !fila.propia) {
      cambiarPiezas((lista) => lista.filter((x) => x.id !== antes.id));
      enSegundoPlano({ quitar: antes.id });
      return;
    }
    if (!limpio && !antes) return;

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

  const quitar = (pieza) => {
    cambiarPiezas((lista) => lista.filter((x) => x.id !== pieza.id));
    enSegundoPlano({ quitar: pieza.id });
  };

  // ---------- Una línea escrita a mano ----------
  //
  // El menú del juego no lo contempla todo, y hay cosas del pedido que no son un número de
  // submenú: «llevar a la ITV», «falta la pieza, avisar al cliente». Sin esto no había dónde
  // anotarlas y terminaban en un papel aparte, que es justo lo que esta pantalla evita.
  const anadirPropia = (e) => {
    e.preventDefault();
    const etiqueta = nombreNuevo.trim().slice(0, 40);
    if (!etiqueta) return;

    const nueva = {
      id: crypto.randomUUID(),
      categoria: null,
      etiqueta,
      valor: valorNuevo.trim().slice(0, 40),
      hecha: false,
    };

    // Se vacía antes de mandar: escribiendo una tras otra se teclea la siguiente mientras la
    // anterior viaja, y limpiar al volver la respuesta borraría lo recién escrito.
    setNombreNuevo('');
    setValorNuevo('');
    campoNuevo.current?.focus();

    cambiarPiezas((lista) => [...lista.filter((x) => claveDe(x) !== claveDe(nueva)), nueva]);
    enSegundoPlano({ agregar: nueva });
  };

  const nuevoPedido = async () => {
    const r = await pedir('/api/tunning', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ piezas: [] }),
    });
    if (r?.pedido) setAbiertoId(r.pedido.id);
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

    // Las escritas a mano. También cae acá una categoría que el almacén trae y el catálogo ya
    // no tiene: se muestra por su nombre —o por su identificador— en vez de quedar en blanco.
    const propias = piezas
      .filter((p) => !categoria(p.categoria))
      .map((p) => ({
        clave: claveDe(p),
        nombre: p.etiqueta ?? p.categoria,
        grupo: 'Otras',
        texto: true,
        propia: true,
        entrada: { categoria: p.categoria, etiqueta: p.etiqueta },
        pieza: p,
      }));

    return [...delCatalogo, ...propias];
  }, [piezas]);

  const porGrupo = useMemo(() => {
    const grupos = new Map([...GRUPOS, 'Otras'].map((g) => [g, []]));
    for (const f of filas) grupos.get(f.grupo)?.push(f);
    return [...grupos.entries()]
      // «Otras» está siempre, aunque no tenga nada: es donde se escribe lo que el menú del
      // juego no contempla, y si desapareciera al quedarse vacía no habría dónde empezar.
      .filter(([grupo, lista]) => lista.length || grupo === 'Otras')
      .map(([grupo, lista]) => ({
        grupo,
        lista,
        puestas: lista.filter((f) => f.pieza).length,
        hechas: lista.filter((f) => f.pieza?.hecha).length,
      }));
  }, [filas]);

  // ---------- El acordeón ----------
  //
  // Con el menú entero son seis secciones y casi cuarenta filas: plegado se llega a cualquiera
  // sin recorrer la página. Es el mismo acordeón de la calculadora, incluido el `Set`.
  const alternar = (grupo) =>
    setAbiertas((prev) => {
      const siguiente = new Set(prev);
      siguiente.has(grupo) ? siguiente.delete(grupo) : siguiente.add(grupo);
      return siguiente;
    });

  const todoAbierto = porGrupo.length > 0 && porGrupo.every(({ grupo }) => abiertas.has(grupo));

  // Arrancan abiertas las secciones que el pedido toca: es lo que hay que trabajar. Si no hay
  // ninguna, la primera, para no dejar la pantalla en blanco.
  const conPiezas = (lista) => {
    const tocadas = lista.filter(({ puestas }) => puestas > 0).map(({ grupo }) => grupo);
    return new Set(tocadas.length ? tocadas : lista.slice(0, 1).map(({ grupo }) => grupo));
  };

  // Al cambiar de pedido se replantea qué está abierto; mientras se trabaja en uno, no, para
  // no volver a desplegar lo que alguien acaba de cerrar.
  useEffect(() => {
    setAbiertas(conPiezas(porGrupo));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abiertoId]);

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
            className="tun-boton-fuerte"
            disabled={ocupado}
            onClick={nuevoPedido}
          >
            Nuevo pedido
          </button>
        </header>

        {error && <p className="panel-error">{error}</p>}

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
          <p className="vacio">
            {abiertos.length === 0
              ? 'No hay pedidos abiertos. Pulsa «Nuevo pedido».'
              : 'Elige un pedido.'}
          </p>
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
                  className="accion"
                  onClick={() =>
                    setAbiertas(todoAbierto ? new Set() : new Set(porGrupo.map((g) => g.grupo)))
                  }
                >
                  {todoAbierto ? 'Cerrar todo' : 'Abrir todo'}
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

            {porGrupo.map(({ grupo, lista, puestas, hechas: hechasGrupo }) => {
              const abierta = abiertas.has(grupo);
              return (
                <div className="tun-grupo" key={grupo}>
                  <button
                    type="button"
                    className={`tun-grupo-cabeza ${puestas ? 'con-piezas' : ''}`}
                    onClick={() => alternar(grupo)}
                    aria-expanded={abierta}
                  >
                    <span className={`flecha ${abierta ? 'abierta' : ''}`} />
                    <span className="tun-grupo-titulo">{grupo}</span>
                    {/* Cerrada, el contador es lo único que dice si ahí queda trabajo. */}
                    <span className="tun-grupo-cuenta">
                      {puestas
                        ? `${hechasGrupo}/${puestas}`
                        : grupo === 'Otras'
                          ? '+ escribir'
                          : `${lista.length} sin usar`}
                    </span>
                  </button>

                  {abierta && (
                    <>
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
                            onQuitar={quitar}
                          />
                        ))}
                      </ul>

                      {/* Lo que el menú del juego no contempla se escribe acá, con sus
                          palabras. El valor es opcional: «falta pieza» ya es todo el recado. */}
                      {grupo === 'Otras' && (
                        <form className="tun-fila tun-nueva" onSubmit={anadirPropia}>
                          <span className="tun-marca-hueco" aria-hidden="true">
                            +
                          </span>
                          <input
                            ref={campoNuevo}
                            className="tun-nombre-nuevo"
                            value={nombreNuevo}
                            onChange={(e) => setNombreNuevo(e.target.value)}
                            placeholder="Escribe lo que falte: «revisar frenos», «llantas del cliente»…"
                            maxLength={40}
                            aria-label="Nombre de la línea nueva"
                          />
                          <input
                            className="tun-campo"
                            value={valorNuevo}
                            onChange={(e) => setValorNuevo(e.target.value)}
                            placeholder="opcional"
                            maxLength={40}
                            spellCheck={false}
                            aria-label="Valor de la línea nueva"
                          />
                          <button
                            type="submit"
                            className="tun-quitar anadir"
                            disabled={!nombreNuevo.trim()}
                            aria-label="Añadir la línea"
                          >
                            ↵
                          </button>
                        </form>
                      )}
                    </>
                  )}
                </div>
              );
            })}
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
          rellenando lo que el pedido trae y las demás quedan en blanco. Vaciar una casilla saca
          esa pieza del pedido. En <strong>Otras</strong> se escribe con tus palabras lo que el
          menú no contempla —«revisar frenos», «las llantas las trae el cliente»—, con número o
          sin él; esas se quitan con la ×. Se marca cada pieza al instalarla; volver a pulsar la
          desmarca.
        </p>
      </main>
    </>
  );
}
