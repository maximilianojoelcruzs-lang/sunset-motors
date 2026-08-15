'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

/** Para buscar: «faldon» tiene que encontrar «Faldón». */
const sinTildes = (texto) =>
  String(texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

// Un arreglo fijo para cuando no hay pedido: con `?? []` se creaba uno nuevo en cada pintado y
// los `useMemo` que dependen de las piezas se recalculaban aunque no hubiera cambiado nada.
const SIN_PIEZAS = [];

/** ¿La lista que acaba de llegar dice lo mismo que la que ya está en pantalla? */
const mismos = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Una fila del catálogo: el nombre fijo y una casilla para el valor.
 *
 * **Acá no se marca nada.** Esta lista es el pedido tal como lo dicta el cliente —el menú
 * entero, para ir rellenando lo que trae—, y el trabajo de instalar se lleva en el resumen de
 * la derecha. Con el check en las dos partes había dos sitios donde tocar lo mismo y ninguno
 * era el que se estaba mirando.
 *
 * Lo tecleado vive **dentro de la fila**, no en la pantalla entera: así escribir un número no
 * vuelve a pintar las otras treinta y siete filas en cada tecla.
 */
const Fila = memo(function Fila({ fila, onGuardar, onQuitar }) {
  const externo = fila.pieza?.valor ?? '';
  const [texto, setTexto] = useState(externo);
  const tecleando = useRef(false);
  const reloj = useRef(null);

  // Mientras se escribe manda lo escrito; el resto del tiempo, lo que diga el servidor. Sin
  // esto la respuesta de una escritura anterior pisaría el campo a media palabra.
  useEffect(() => {
    if (!tecleando.current) setTexto(externo);
  }, [externo]);

  // El temporizador de escritura no puede sobrevivir a la fila.
  useEffect(() => () => clearTimeout(reloj.current), []);

  // Se manda al parar de teclear, no en cada tecla: escribir «12» son dos escrituras completas
  // de la colección para un solo número.
  const escribir = (valor) => {
    tecleando.current = true;
    setTexto(valor);
    clearTimeout(reloj.current);
    reloj.current = setTimeout(() => onGuardar(fila, valor), 500);
  };

  // Al salir del campo se manda ya, sin esperar el medio segundo.
  const cerrar = () => {
    clearTimeout(reloj.current);
    tecleando.current = false;
    onGuardar(fila, texto);
  };

  const puesta = Boolean(fila.pieza);
  const hecha = Boolean(fila.pieza?.hecha);

  return (
    <li
      className={`tun-fila ${puesta ? 'puesta' : 'vacia'} ${hecha ? 'hecha' : ''} ${
        fila.texto ? 'texto' : ''
      } ${fila.propia ? 'propia' : ''}`}
    >
      <span className="tun-categoria">
        <span className="tun-nombre-cat">{fila.nombre}</span>
        {/* Instalada se ve, no se toca: el check está en el resumen. */}
        {hecha && (
          <span className="tun-hecha-marca" title="Ya instalada">
            ✓
          </span>
        )}
      </span>

      <input
        className={`tun-campo ${fila.texto ? 'ancho' : ''}`}
        value={texto}
        onChange={(e) => escribir(e.target.value)}
        onBlur={cerrar}
        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), e.target.blur())}
        placeholder={fila.propia ? 'opcional' : fila.texto ? 'color' : 'nº'}
        maxLength={40}
        spellCheck={false}
        title={texto || undefined}
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
});

/**
 * La línea escrita a mano, con su propio estado.
 *
 * Aparte y no en la pantalla: escribiendo «revisar frenos» se repintaba todo el menú letra a
 * letra, y eso es justamente lo que se sentía pegado.
 */
const FilaNueva = memo(function FilaNueva({ onAnadir }) {
  const [nombre, setNombre] = useState('');
  const [valor, setValor] = useState('');
  const campo = useRef(null);

  const enviar = (e) => {
    e.preventDefault();
    const etiqueta = nombre.trim().slice(0, 40);
    if (!etiqueta) return;

    // Se vacía antes de mandar: escribiendo una tras otra se teclea la siguiente mientras la
    // anterior viaja, y limpiar al volver la respuesta borraría lo recién escrito.
    setNombre('');
    setValor('');
    campo.current?.focus();
    onAnadir(etiqueta, valor.trim().slice(0, 40));
  };

  return (
    <form className="tun-fila tun-nueva" onSubmit={enviar}>
      <input
        ref={campo}
        className="tun-nombre-nuevo"
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        placeholder="Escribe lo que falte: «revisar frenos», «llantas del cliente»…"
        maxLength={40}
        aria-label="Nombre de la línea nueva"
      />
      <input
        className="tun-campo"
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        placeholder="opcional"
        maxLength={40}
        spellCheck={false}
        aria-label="Valor de la línea nueva"
      />
      <button
        type="submit"
        className="tun-quitar anadir"
        disabled={!nombre.trim()}
        aria-label="Añadir la línea"
      >
        ↵
      </button>
    </form>
  );
});

/**
 * Una sección del menú, plegable.
 *
 * Memorizada: al desplegar una, o al marcar una pieza, las demás no vuelven a pintarse.
 */
const Grupo = memo(function Grupo({
  grupo,
  lista,
  puestas,
  hechas,
  abierta,
  onAlternar,
  onGuardar,
  onQuitar,
  onAnadir,
}) {
  return (
    <div className="tun-grupo">
      <button
        type="button"
        className={`tun-grupo-cabeza ${puestas ? 'con-piezas' : ''}`}
        onClick={() => onAlternar(grupo)}
        aria-expanded={abierta}
      >
        <span className={`flecha ${abierta ? 'abierta' : ''}`} />
        <span className="tun-grupo-titulo">{grupo}</span>
        {/* Cerrada, el contador es lo único que dice si ahí queda trabajo. */}
        <span className="tun-grupo-cuenta">
          {puestas
            ? `${hechas}/${puestas}`
            : grupo === 'Otras'
              ? '+ escribir'
              : `${lista.length} sin usar`}
        </span>
      </button>

      {abierta && (
        <>
          <ul className="tun-filas">
            {lista.map((f) => (
              <Fila key={f.clave} fila={f} onGuardar={onGuardar} onQuitar={onQuitar} />
            ))}
          </ul>

          {/* Lo que el menú del juego no contempla se escribe acá, con sus palabras. El valor
              es opcional: «falta pieza» ya es todo el recado. */}
          {grupo === 'Otras' && <FilaNueva onAnadir={onAnadir} />}
        </>
      )}
    </div>
  );
});

/**
 * El resumen: la lista corta del pedido, y **el único sitio donde se marca**.
 *
 * Acá está lo que hay que ir a buscar al almacén y lo que hay que instalar, sin las treinta
 * categorías en blanco del menú. Se marca donde se lee, que es lo que evita bajar a buscar la
 * fila del catálogo cada vez que se termina una pieza.
 */
const Resumen = memo(function Resumen({ lista, hechas, onMarcar }) {
  const total = lista.length;
  const avance = total ? Math.round((hechas / total) * 100) : 0;

  return (
    <aside className="tun-resumen">
      <h3 className="tun-resumen-titulo">
        Piezas del pedido{' '}
        <span>
          {hechas}/{total}
        </span>
      </h3>

      {total === 0 ? (
        <p className="tun-resumen-vacio">
          Rellena las casillas de la izquierda y aquí queda la lista corta, sin las categorías
          que el pedido no trae. Desde aquí se marca cada pieza al instalarla.
        </p>
      ) : (
        <>
          <div className="tun-avance" role="presentation">
            <span style={{ width: `${avance}%` }} />
          </div>

          <ul className="tun-resumen-lista">
            {lista.map((r) => (
              <li
                key={r.clave}
                className={`${r.hecha ? 'hecha' : ''} ${r.siguiente ? 'siguiente' : ''}`}
              >
                <button
                  type="button"
                  className="tun-resumen-fila"
                  onClick={() => onMarcar(r.id, !r.hecha)}
                  aria-pressed={r.hecha}
                  aria-label={`${r.nombre}${r.valor ? ` ${r.valor}` : ''} · ${
                    r.hecha ? 'instalada' : 'pendiente'
                  }`}
                >
                  <span className="tun-check" aria-hidden="true">
                    {r.hecha ? '✓' : ''}
                  </span>
                  <span className="tun-resumen-grupo">{r.grupo}</span>
                  <span className="tun-resumen-nombre">{r.nombre}</span>
                  <span className="tun-resumen-valor">{r.valor}</span>
                </button>
              </li>
            ))}
          </ul>

          <p className="tun-resumen-pie">
            {hechas} de {total} instaladas · toca una línea para marcarla
          </p>
        </>
      )}
    </aside>
  );
});

export default function Tunning({ usuario, admin, accesos, iniciales, turnoPropio, fallo }) {
  const [pedidos, setPedidos] = useState(iniciales);
  const [turno, setTurno] = useState(turnoPropio);
  const [abiertoId, setAbiertoId] = useState(iniciales.find((p) => !p.cerrado)?.id ?? null);
  // Qué secciones están desplegadas. Un `Set`, igual que en la calculadora.
  const [abiertas, setAbiertas] = useState(new Set());
  const [filtro, setFiltro] = useState('');
  const [error, setError] = useState(fallo);
  const [ocupado, setOcupado] = useState(false);

  const pendientes = useRef(0);
  const cola = useRef(Promise.resolve());

  const recargar = useCallback(async () => {
    const r = await fetch('/api/tunning', { cache: 'no-store' });
    const cuerpo = await r.json().catch(() => ({}));
    if (!r.ok || !cuerpo.pedidos) return;
    // Si el servidor dice lo mismo que ya hay, no se toca el estado: cambiar la referencia
    // cada quince segundos repinta las cuarenta filas para nada.
    setPedidos((antes) => (mismos(antes, cuerpo.pedidos) ? antes : cuerpo.pedidos));
  }, []);

  // El pedido es de quien lo abre, pero la misma persona puede tenerlo abierto en el PC y en
  // el teléfono: la lista se pone al día sola para que las dos pantallas digan lo mismo.
  useSondeo(() => (pendientes.current ? undefined : recargar()), 15000);

  const pedido = pedidos.find((p) => p.id === abiertoId) ?? null;
  const piezas = pedido?.piezas ?? SIN_PIEZAS;
  const hechas = piezas.filter((p) => p.hecha).length;

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
  const cambiarPiezas = useCallback(
    (hacer) =>
      setPedidos((antes) =>
        antes.map((p) => (p.id === abiertoId ? { ...p, piezas: hacer(p.piezas) } : p))
      ),
    [abiertoId]
  );

  /**
   * Manda un cambio sin bloquear la pantalla, y **de a uno**.
   *
   * En cola y no en paralelo porque cada escritura lee y reescribe la colección entera: dos a
   * la vez se pisan y una de las dos se pierde. Escribiendo rápido eso pasa siempre.
   */
  const enSegundoPlano = useCallback(
    (cambios) => {
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
    },
    [abiertoId, recargar]
  );

  // Marcar viene del resumen, así que lo que llega es el identificador de la pieza y no la
  // pieza entera: la fila del resumen es una copia liviana, no el objeto guardado.
  const marcar = useCallback(
    (id, hecha) => {
      cambiarPiezas((lista) => lista.map((x) => (x.id === id ? { ...x, hecha } : x)));
      enSegundoPlano({ pieza: id, hecha });
    },
    [cambiarPiezas, enSegundoPlano]
  );

  const quitar = useCallback(
    (pieza) => {
      cambiarPiezas((lista) => lista.filter((x) => x.id !== pieza.id));
      enSegundoPlano({ quitar: pieza.id });
    },
    [cambiarPiezas, enSegundoPlano]
  );

  // ---------- Escribir el valor de una fila ----------
  const guardar = useCallback(
    (fila, texto) => {
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

      // El identificador lo pone el navegador y el servidor lo respeta, para que la fila
      // pintada y la guardada sean la misma pieza y se pueda marcar sin esperar a la
      // siguiente lectura.
      const nueva = { id: crypto.randomUUID(), ...fila.entrada, valor: limpio, hecha: false };
      cambiarPiezas((lista) => [...lista, nueva]);
      enSegundoPlano({ agregar: nueva });
    },
    [cambiarPiezas, enSegundoPlano]
  );

  // ---------- Una línea escrita a mano ----------
  //
  // El menú del juego no lo contempla todo, y hay cosas del pedido que no son un número de
  // submenú: «llevar a la ITV», «falta la pieza, avisar al cliente». Sin esto no había dónde
  // anotarlas y terminaban en un papel aparte, que es justo lo que esta pantalla evita.
  const anadirPropia = useCallback(
    (etiqueta, valor) => {
      const nueva = { id: crypto.randomUUID(), categoria: null, etiqueta, valor, hecha: false };
      cambiarPiezas((lista) => [...lista.filter((x) => claveDe(x) !== claveDe(nueva)), nueva]);
      enSegundoPlano({ agregar: nueva });
    },
    [cambiarPiezas, enSegundoPlano]
  );

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
      // Normalizado una sola vez, no en cada tecla del buscador: son 38 nombres y el filtro
      // corre entero con cada letra que se escribe.
      buscable: sinTildes(c.nombre),
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
        buscable: sinTildes(p.etiqueta ?? p.categoria),
        grupo: 'Otras',
        texto: true,
        propia: true,
        entrada: { categoria: p.categoria, etiqueta: p.etiqueta },
        pieza: p,
      }));

    return [...delCatalogo, ...propias];
  }, [piezas]);

  // Buscar por nombre. Con casi cuarenta filas repartidas en siete secciones, escribir «tech»
  // llega antes que bajar buscando con el ojo. Sin tildes ni mayúsculas: nadie escribe «Faldón»
  // con acento cuando va con prisa.
  const busqueda = sinTildes(filtro.trim());

  const porGrupo = useMemo(() => {
    const grupos = new Map([...GRUPOS, 'Otras'].map((g) => [g, []]));
    for (const f of filas) {
      if (busqueda && !f.buscable.includes(busqueda)) continue;
      grupos.get(f.grupo)?.push(f);
    }
    return [...grupos.entries()]
      // «Otras» está siempre, aunque no tenga nada: es donde se escribe lo que el menú del
      // juego no contempla, y si desapareciera al quedarse vacía no habría dónde empezar.
      // Buscando sí se esconde: una sección vacía entre los resultados solo estorba.
      .filter(([grupo, lista]) => lista.length || (grupo === 'Otras' && !busqueda))
      .map(([grupo, lista]) => ({
        grupo,
        lista,
        puestas: lista.filter((f) => f.pieza).length,
        hechas: lista.filter((f) => f.pieza?.hecha).length,
      }));
  }, [filas, busqueda]);

  const coincidencias = useMemo(
    () => porGrupo.reduce((n, g) => n + g.lista.length, 0),
    [porGrupo]
  );

  // ---------- El resumen de la derecha ----------
  //
  // Lo que hay que ir a buscar al almacén y lo que hay que ir marcando. La lista de la
  // izquierda es el menú entero —hay que verlo para rellenarlo—, pero para trabajar solo
  // importan las piezas que el pedido trae, y ahí sobran treinta filas en blanco.
  const resumen = useMemo(() => {
    let primeraPendiente = true;
    return filas
      .filter((f) => f.pieza)
      .map((f) => {
        const siguiente = !f.pieza.hecha && primeraPendiente;
        if (siguiente) primeraPendiente = false;
        return {
          clave: f.clave,
          id: f.pieza.id,
          nombre: f.nombre,
          valor: f.pieza.valor,
          hecha: Boolean(f.pieza.hecha),
          grupo: f.grupo,
          siguiente,
        };
      });
  }, [filas]);

  // ---------- El acordeón ----------
  //
  // Con el menú entero son seis secciones y casi cuarenta filas: plegado se llega a cualquiera
  // sin recorrer la página. Es el mismo acordeón de la calculadora, incluido el `Set`.
  const alternar = useCallback(
    (grupo) =>
      setAbiertas((prev) => {
        const siguiente = new Set(prev);
        siguiente.has(grupo) ? siguiente.delete(grupo) : siguiente.add(grupo);
        return siguiente;
      }),
    []
  );

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
            <p className="titulo-bajada">
              A la izquierda el pedido; a la derecha se marca lo instalado
            </p>
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

            <div className="tun-buscar">
              <input
                type="search"
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
                placeholder="Buscar pieza por nombre…"
                aria-label="Buscar pieza por nombre"
              />
              {busqueda && (
                <span className="tun-buscar-cuenta">
                  {coincidencias} coincidencia{coincidencias === 1 ? '' : 's'}
                </span>
              )}
            </div>

            <div className="tun-columnas">
              <div className="tun-menu">
                {porGrupo.map(({ grupo, lista, puestas, hechas: hechasGrupo }) => (
                  <Grupo
                    key={grupo}
                    grupo={grupo}
                    lista={lista}
                    puestas={puestas}
                    hechas={hechasGrupo}
                    // Buscando se abren todas: esconder un resultado detrás de una cabecera
                    // plegada es exactamente lo contrario de buscar. Igual que en la calculadora.
                    abierta={abiertas.has(grupo) || Boolean(busqueda)}
                    onAlternar={alternar}
                    onGuardar={guardar}
                    onQuitar={quitar}
                    onAnadir={anadirPropia}
                  />
                ))}
              </div>

              <Resumen lista={resumen} hechas={hechas} onMarcar={marcar} />
            </div>
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
          A la izquierda está el menú completo, en el mismo orden que en el juego: se baja una
          vez por sección rellenando lo que el pedido trae y las demás quedan en blanco. Vaciar
          una casilla saca esa pieza del pedido. En <strong>Otras</strong> se escribe con tus
          palabras lo que el menú no contempla —«revisar frenos», «las llantas las trae el
          cliente»—, con número o sin él; esas se quitan con la ×. <strong>Se marca en la
          lista de la derecha</strong>, que es el pedido ya resumido: se toca una línea al
          instalarla y volver a tocarla la desmarca.
        </p>
      </main>
    </>
  );
}
