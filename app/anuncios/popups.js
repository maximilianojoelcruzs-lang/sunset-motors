'use client';

import { memo, useCallback, useEffect, useState } from 'react';
import { desdeInput, paraInput, soloFecha, soloHora } from '../../lib/tiempo';

/**
 * El panel del encargado para los pop-ups que salen al entrar.
 *
 * Vive en Anuncios, con los flyers y los mensajes, porque es lo mismo: cosas que el encargado
 * publica para que el taller las vea. Solo lo ve un administrador.
 */

/** Atajos para el tiempo límite. Es lo que se usa de verdad: «hoy», «este fin de semana». */
const ATAJOS = [
  { rotulo: '2 horas', horas: 2 },
  { rotulo: 'Hoy', horas: null, finDelDia: true },
  { rotulo: '3 días', horas: 72 },
  { rotulo: '1 semana', horas: 168 },
];

const enHoras = (horas) => new Date(Date.now() + horas * 3600 * 1000);

const finDeHoy = () => {
  const d = new Date();
  d.setHours(23, 59, 0, 0);
  // Si ya pasaron las 23:59, «hoy» no sirve de nada: se toma el final del día siguiente.
  if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
  return d;
};

const cuando = (iso) => (iso ? `${soloFecha(iso)} a las ${soloHora(iso)}` : 'sin límite');

const Fila = memo(function Fila({ p, ahora, onAlternar, onBorrar, onEditar, ocupado }) {
  const vencido = p.hasta && Date.parse(p.hasta) <= ahora;
  const apagado = p.activo === false;
  const saliendo = !vencido && !apagado;

  return (
    <li className={saliendo ? 'popup-fila saliendo' : 'popup-fila'}>
      <span className="popup-fila-texto">
        <strong>{p.titulo}</strong>
        <span className="popup-fila-cuerpo">{p.texto}</span>
        <em className="popup-fila-estado">
          {saliendo ? 'Saliendo ahora' : vencido ? 'Se pasó el tiempo' : 'Apagado'} · hasta{' '}
          {cuando(p.hasta)} · {p.creadoPor}
          {p.imagen && ' · con imagen'}
        </em>
      </span>
      <span className="fila-acciones">
        <button type="button" className="accion" disabled={ocupado} onClick={() => onEditar(p)}>
          Editar
        </button>
        <button
          type="button"
          className="accion"
          disabled={ocupado}
          onClick={() => onAlternar(p)}
          title={vencido ? 'Se pasó el tiempo límite: cámbialo para volver a mostrarlo' : ''}
        >
          {apagado ? 'Encender' : 'Apagar'}
        </button>
        <button
          type="button"
          className="accion peligro"
          disabled={ocupado}
          onClick={() => onBorrar(p)}
        >
          Borrar
        </button>
      </span>
    </li>
  );
});

export default function Popups() {
  const [popups, setPopups] = useState([]);
  const [abierto, setAbierto] = useState(false);
  const [escribiendo, setEscribiendo] = useState(false);
  const [editando, setEditando] = useState(null);
  const [titulo, setTitulo] = useState('');
  const [texto, setTexto] = useState('');
  const [imagen, setImagen] = useState('');
  const [hasta, setHasta] = useState(paraInput(finDeHoy().toISOString()));
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [ahora, setAhora] = useState(() => Date.now());

  const recargar = useCallback(async () => {
    const r = await fetch('/api/popups?todos=1', { cache: 'no-store' });
    if (!r.ok) return;
    const { popups: lista } = await r.json().catch(() => ({}));
    if (Array.isArray(lista)) setPopups(lista);
    setAhora(Date.now());
  }, []);

  useEffect(() => {
    if (abierto) recargar();
  }, [abierto, recargar]);

  const pedir = async (url, opciones, exito) => {
    setOcupado(true);
    setError('');
    setAviso('');
    try {
      const r = await fetch(url, opciones);
      const cuerpo = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(cuerpo.error || 'No se pudo completar.');
        return false;
      }
      setAviso(exito);
      await recargar();
      return true;
    } catch {
      setError('Sin conexión con el servidor.');
      return false;
    } finally {
      setOcupado(false);
    }
  };

  const limpiar = () => {
    setEscribiendo(false);
    setEditando(null);
    setTitulo('');
    setTexto('');
    setImagen('');
    setHasta(paraInput(finDeHoy().toISOString()));
  };

  const guardar = async (e) => {
    e.preventDefault();
    const cuerpo = {
      titulo,
      texto,
      imagen,
      // Por `desdeInput` y no `new Date(...)`: el campo está en hora de Chile, que es la que
      // usa toda la app. Con `new Date` se interpretaría en la zona del navegador, y un
      // encargado conectado desde otro país pondría el límite corrido varias horas.
      hasta: hasta ? desdeInput(hasta) : null,
    };
    const ok = await pedir(
      editando ? `/api/popups/${editando}` : '/api/popups',
      {
        method: editando ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cuerpo),
      },
      editando ? 'Pop-up actualizado.' : 'Pop-up publicado: sale al entrar.'
    );
    if (ok) limpiar();
  };

  const editar = useCallback((p) => {
    setEditando(p.id);
    setEscribiendo(true);
    setTitulo(p.titulo);
    setTexto(p.texto);
    setImagen(p.imagen ?? '');
    setHasta(p.hasta ? paraInput(p.hasta) : '');
  }, []);

  const alternar = useCallback(
    (p) =>
      pedir(
        `/api/popups/${p.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ activo: p.activo === false }),
        },
        p.activo === false ? 'Encendido.' : 'Apagado: ya no le sale a nadie.'
      ),
    []
  );

  const borrar = useCallback((p) => {
    if (!window.confirm(`¿Borrar el pop-up «${p.titulo}»?`)) return;
    pedir(`/api/popups/${p.id}`, { method: 'DELETE' }, 'Pop-up borrado.');
  }, []);

  const saliendo = popups.filter((p) => p.activo !== false && (!p.hasta || Date.parse(p.hasta) > ahora));

  return (
    <section className="mecanicos">
      <button
        type="button"
        className="mecanicos-cabeza"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
      >
        <span className={`flecha ${abierto ? 'abierta' : ''}`} />
        <span className="ref-titulo">Pop-ups al entrar</span>
        <span className="mecanicos-cuenta">{saliendo.length}</span>
      </button>

      {abierto && (
        <div className="mecanicos-cuerpo">
          <p className="tun-ayuda">
            Sale como cartel en cuanto alguien entra a la app, y no se puede seguir sin cerrarlo.
            Cada uno lleva su <strong>tiempo límite</strong>: pasada esa hora deja de salir solo,
            sin que nadie tenga que acordarse de apagarlo.
          </p>

          {error && <p className="panel-error">{error}</p>}
          {aviso && <p className="mecanicos-aviso">{aviso}</p>}

          {!escribiendo && (
            <button type="button" className="accion destacada" onClick={() => setEscribiendo(true)}>
              Escribir un pop-up
            </button>
          )}

          {escribiendo && (
            <form className="soli-nueva soli-forma" onSubmit={guardar}>
              <label className="campo">
                <span>Título</span>
                <input
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  maxLength={80}
                  placeholder="Hoy cerramos a las 22:00"
                  required
                />
              </label>

              <label className="campo">
                <span>Mensaje</span>
                <textarea
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  maxLength={600}
                  rows={4}
                  placeholder="El elevador 2 está en mantención. Usen el 1 y el 3."
                  required
                />
              </label>

              <label className="campo">
                <span>Imagen (opcional) — pega el enlace</span>
                <input
                  value={imagen}
                  onChange={(e) => setImagen(e.target.value)}
                  placeholder="https://…/imagen.png"
                  inputMode="url"
                />
              </label>
              {imagen.trim() && (
                <img
                  className="captura-previa"
                  src={imagen.trim()}
                  alt="Vista previa"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              )}

              <label className="campo">
                <span>Tiempo límite — deja de salir después de esta hora</span>
                <input
                  type="datetime-local"
                  value={hasta}
                  onChange={(e) => setHasta(e.target.value)}
                />
              </label>
              <div className="popup-atajos">
                {ATAJOS.map((a) => (
                  <button
                    type="button"
                    key={a.rotulo}
                    className="accion"
                    onClick={() =>
                      setHasta(paraInput((a.finDelDia ? finDeHoy() : enHoras(a.horas)).toISOString()))
                    }
                  >
                    {a.rotulo}
                  </button>
                ))}
                <button type="button" className="accion" onClick={() => setHasta('')}>
                  Sin límite
                </button>
              </div>

              <div className="soli-botones">
                <button type="submit" className="accion" disabled={ocupado}>
                  {ocupado ? 'Guardando…' : editando ? 'Guardar cambios' : 'Publicar'}
                </button>
                <button type="button" className="accion" onClick={limpiar}>
                  Cancelar
                </button>
              </div>
            </form>
          )}

          {popups.length === 0 ? (
            <p className="vacio">Todavía no hay pop-ups. El primero sale en cuanto lo publiques.</p>
          ) : (
            <ul className="popup-lista">
              {popups.map((p) => (
                <Fila
                  key={p.id}
                  p={p}
                  ahora={ahora}
                  onAlternar={alternar}
                  onBorrar={borrar}
                  onEditar={editar}
                  ocupado={ocupado}
                />
              ))}
            </ul>
          )}

          <p className="pie">
            Sale una vez por entrada: al iniciar sesión y al abrir la app en otra pestaña.
            Recargar la misma pestaña no lo repite, para que no estorbe a quien ya lo leyó.
          </p>
        </div>
      )}
    </section>
  );
}
