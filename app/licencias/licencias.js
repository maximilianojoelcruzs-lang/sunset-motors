'use client';

import { useMemo, useState } from 'react';
import Barra from '../barra';
import useSondeo from '../sondeo';
import { soloFecha } from '../../lib/tiempo';

const ROTULO = {
  borrador: 'Borrador',
  enviada: 'Esperando respuesta',
  aprobada: 'Aprobada',
  rechazada: 'Rechazada',
};

const hoy = () => new Date().toISOString().slice(0, 10);

/** Días que abarca, contando inicio y fin. */
const dias = (s) =>
  Math.round((Date.parse(s.fin) - Date.parse(s.inicio)) / 86400000) + 1;

function Formulario({ inicial, onGuardar, onCancelar, ocupado }) {
  const [tipo, setTipo] = useState(inicial?.tipo ?? 'licencia');
  const [inicio, setInicio] = useState(inicial?.inicio ?? hoy());
  const [fin, setFin] = useState(inicial?.fin ?? hoy());
  const [motivo, setMotivo] = useState(inicial?.motivo ?? '');

  return (
    <form
      className="soli-forma"
      onSubmit={(e) => {
        e.preventDefault();
        onGuardar({ tipo, inicio, fin, motivo });
      }}
    >
      <div className="soli-campos">
        <label className="campo-inline">
          <span>Tipo</span>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="licencia">Licencia</option>
            <option value="ausencia">Ausencia</option>
          </select>
        </label>
        <label className="campo-inline">
          <span>Desde</span>
          <input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} required />
        </label>
        <label className="campo-inline">
          <span>Hasta</span>
          <input
            type="date"
            value={fin}
            min={inicio}
            onChange={(e) => setFin(e.target.value)}
            required
          />
        </label>
      </div>

      <label className="campo">
        <span>Motivo</span>
        <textarea
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          rows={3}
          maxLength={400}
          placeholder="Por qué necesitas estos días"
          required
        />
      </label>

      <div className="soli-botones">
        <button type="submit" className="accion" disabled={ocupado}>
          {ocupado ? 'Guardando…' : inicial ? 'Guardar cambios' : 'Guardar borrador'}
        </button>
        {onCancelar && (
          <button type="button" className="accion" onClick={onCancelar}>
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}

function Tarjeta({ s, mia, admin, onAccion, ocupado }) {
  const [respuesta, setRespuesta] = useState('');
  const [decidiendo, setDecidiendo] = useState(null);
  const sinResolver = s.estado === 'borrador' || s.estado === 'enviada';

  return (
    <article className={`soli soli-${s.estado}`}>
      <div className="soli-cabeza">
        <span className="soli-tipo">{s.tipo === 'licencia' ? 'Licencia' : 'Ausencia'}</span>
        {!mia && <span className="soli-quien">{s.usuario}</span>}
        <span className={`soli-estado ${s.estado}`}>{ROTULO[s.estado]}</span>
      </div>

      <p className="soli-fechas">
        {soloFecha(`${s.inicio}T12:00:00Z`)} → {soloFecha(`${s.fin}T12:00:00Z`)}
        <span className="soli-dias">
          {dias(s)} día{dias(s) === 1 ? '' : 's'}
        </span>
      </p>

      <p className="soli-motivo">{s.motivo}</p>

      {s.respuesta && (
        <p className="soli-respuesta">
          {s.resueltoPor}: «{s.respuesta}»
        </p>
      )}

      <div className="soli-acciones">
        {mia && s.estado === 'borrador' && (
          <button
            type="button"
            className="accion destacada"
            disabled={ocupado}
            onClick={() => onAccion('enviar', s)}
          >
            Enviar
          </button>
        )}
        {mia && sinResolver && (
          <button type="button" className="accion" disabled={ocupado} onClick={() => onAccion('editar', s)}>
            Editar
          </button>
        )}
        {(mia && sinResolver) || admin ? (
          <button
            type="button"
            className="accion peligro"
            disabled={ocupado}
            onClick={() => onAccion('borrar', s)}
          >
            Eliminar
          </button>
        ) : null}

        {admin && s.estado === 'enviada' && !decidiendo && (
          <>
            <button type="button" className="accion destacada" onClick={() => setDecidiendo('aprobar')}>
              Aprobar
            </button>
            <button type="button" className="accion peligro" onClick={() => setDecidiendo('rechazar')}>
              Rechazar
            </button>
          </>
        )}
      </div>

      {admin && decidiendo && (
        <div className="soli-decision">
          <input
            type="text"
            value={respuesta}
            maxLength={300}
            placeholder={
              decidiendo === 'aprobar' ? 'Comentario (opcional)' : 'Motivo del rechazo (opcional)'
            }
            onChange={(e) => setRespuesta(e.target.value)}
          />
          <button
            type="button"
            className={`accion ${decidiendo === 'aprobar' ? 'destacada' : 'peligro'}`}
            disabled={ocupado}
            onClick={() => {
              onAccion(decidiendo, s, respuesta);
              setDecidiendo(null);
              setRespuesta('');
            }}
          >
            Confirmar {decidiendo === 'aprobar' ? 'aprobación' : 'rechazo'}
          </button>
          <button type="button" className="accion" onClick={() => setDecidiendo(null)}>
            Cancelar
          </button>
        </div>
      )}
    </article>
  );
}

export default function Licencias({
  usuario,
  admin,
  accesos,
  miasIniciales,
  todasIniciales,
  turnoPropio,
  fallo,
}) {
  const [mias, setMias] = useState(miasIniciales);
  const [todas, setTodas] = useState(todasIniciales);
  const [turno, setTurno] = useState(turnoPropio);
  const [creando, setCreando] = useState(false);
  const [editando, setEditando] = useState(null);
  const [pestana, setPestana] = useState(admin ? 'porRevisar' : 'mias');
  const [error, setError] = useState(fallo);
  const [aviso, setAviso] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const recargar = async () => {
    const [a, b] = await Promise.all([
      fetch('/api/licencias', { cache: 'no-store' }).then((r) => r.json()),
      admin
        ? fetch('/api/licencias?todas=1', { cache: 'no-store' }).then((r) => r.json())
        : Promise.resolve({ solicitudes: [] }),
    ]);
    if (a.solicitudes) setMias(a.solicitudes);
    if (b.solicitudes) setTodas(b.solicitudes);
  };

  // La pantalla se pone al día sola: nadie tiene que apretar F5 para ver lo que llegó.
  useSondeo(recargar, 20000);

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

  const json = (cuerpo) => ({
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
  });

  const guardarNueva = (datos, enviar) =>
    pedir(
      '/api/licencias',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...datos, enviar }),
      },
      enviar ? 'Solicitud enviada al encargado.' : 'Borrador guardado.'
    ).then((ok) => ok && setCreando(false));

  const accion = (que, s, respuesta) => {
    if (que === 'editar') return setEditando(s.id);
    if (que === 'enviar') {
      return pedir(`/api/licencias/${s.id}`, json({ accion: 'enviar' }), 'Solicitud enviada.');
    }
    if (que === 'borrar') {
      if (!window.confirm('¿Eliminar esta solicitud? No se puede deshacer.')) return;
      return pedir(`/api/licencias/${s.id}`, { method: 'DELETE' }, 'Solicitud eliminada.');
    }
    if (que === 'aprobar' || que === 'rechazar') {
      return pedir(
        `/api/licencias/${s.id}`,
        json({ accion: que, respuesta }),
        que === 'aprobar' ? 'Aprobada. Se le avisó a la persona.' : 'Rechazada. Se le avisó.'
      );
    }
  };

  const porRevisar = useMemo(() => todas.filter((s) => s.estado === 'enviada'), [todas]);
  const resueltas = useMemo(() => todas.filter((s) => s.estado !== 'enviada'), [todas]);

  const lista =
    pestana === 'mias' ? mias : pestana === 'porRevisar' ? porRevisar : resueltas;

  return (
    <>
      <Barra
        usuario={usuario}
        admin={admin}
        accesos={accesos}
        seccion="licencias"
        turno={turno}
        onTurnoCambio={setTurno}
      />
      <main className="envoltura">
        <header className="titulo">
          <div>
            <h1 className="titulo-texto">Licencias y ausencias</h1>
            <p className="titulo-bajada">Solicitudes del taller</p>
          </div>
          {!creando && (
            <button type="button" className="accion destacada" onClick={() => setCreando(true)}>
              Nueva solicitud
            </button>
          )}
        </header>

        {error && <p className="panel-error">{error}</p>}
        {aviso && <p className="mecanicos-aviso">{aviso}</p>}

        {creando && (
          <section className="soli-nueva">
            <h2 className="ref-titulo">Nueva solicitud</h2>
            <Formulario
              ocupado={ocupado}
              onCancelar={() => setCreando(false)}
              onGuardar={(datos) => guardarNueva(datos, false)}
            />
            <p className="forma-pie">
              Se guarda como borrador: puedes revisarla y después pulsar «Enviar». Mientras
              sea borrador, el encargado no la ve.
            </p>
          </section>
        )}

        {admin && (
          <div className="pestanas">
            <button
              type="button"
              className={`pestana ${pestana === 'porRevisar' ? 'activa' : ''}`}
              onClick={() => setPestana('porRevisar')}
            >
              Por revisar
              {porRevisar.length > 0 && <span className="pestana-cuenta">{porRevisar.length}</span>}
            </button>
            <button
              type="button"
              className={`pestana ${pestana === 'resueltas' ? 'activa' : ''}`}
              onClick={() => setPestana('resueltas')}
            >
              Resueltas
            </button>
            <button
              type="button"
              className={`pestana ${pestana === 'mias' ? 'activa' : ''}`}
              onClick={() => setPestana('mias')}
            >
              Las mías
            </button>
          </div>
        )}

        {lista.length === 0 ? (
          <p className="vacio">
            {pestana === 'porRevisar'
              ? 'No hay solicitudes esperando respuesta.'
              : pestana === 'resueltas'
                ? 'Todavía no has resuelto ninguna.'
                : 'No tienes solicitudes. Crea una con «Nueva solicitud».'}
          </p>
        ) : (
          <div className="soli-lista">
            {lista.map((s) =>
              editando === s.id ? (
                <section className="soli-nueva" key={s.id}>
                  <h2 className="ref-titulo">Editando</h2>
                  <Formulario
                    inicial={s}
                    ocupado={ocupado}
                    onCancelar={() => setEditando(null)}
                    onGuardar={(datos) =>
                      pedir(`/api/licencias/${s.id}`, json(datos), 'Solicitud actualizada.').then(
                        (ok) => ok && setEditando(null)
                      )
                    }
                  />
                </section>
              ) : (
                <Tarjeta
                  key={s.id}
                  s={s}
                  mia={s.usuario === usuario}
                  admin={admin && pestana !== 'mias'}
                  ocupado={ocupado}
                  onAccion={accion}
                />
              )
            )}
          </div>
        )}

        <p className="pie">
          Cuando el encargado responde, te llega un aviso en la campanita de arriba. Una
          solicitud ya resuelta queda como registro y no se puede editar.
        </p>
      </main>
    </>
  );
}
