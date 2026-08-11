'use client';

import { useMemo, useState } from 'react';
import Barra from '../barra';
import Dialogo from '../dialogo';

const pesos = new Intl.NumberFormat('es-CL');
const plata = (n) => `$${pesos.format(n)}`;

const ROTULO = {
  borrador: 'Borrador',
  pendiente: 'Pendiente de pagar',
  pagado: 'Pagado',
  rechazado: 'Rechazado',
};

function Formulario({ inicial, onGuardar, onCancelar, ocupado }) {
  const [monto, setMonto] = useState(inicial ? String(inicial.monto) : '');
  const [descripcion, setDescripcion] = useState(inicial?.descripcion ?? '');
  const [archivo, setArchivo] = useState(null);
  const [vistaPrevia, setVistaPrevia] = useState(null);

  const elegir = (e) => {
    const f = e.target.files?.[0] ?? null;
    setArchivo(f);
    setVistaPrevia(f ? URL.createObjectURL(f) : null);
  };

  return (
    <form
      className="soli-forma"
      onSubmit={(e) => {
        e.preventDefault();
        const forma = new FormData();
        forma.set('monto', monto);
        forma.set('descripcion', descripcion);
        if (archivo) forma.set('captura', archivo);
        onGuardar(forma);
      }}
    >
      <div className="soli-campos">
        <label className="campo-inline">
          <span>Monto a devolver</span>
          <input
            type="text"
            inputMode="numeric"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            placeholder="12500"
            required
          />
        </label>
      </div>

      <label className="campo">
        <span>De qué es</span>
        <textarea
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          rows={2}
          maxLength={300}
          placeholder="Qué compraste o pagaste de tu bolsillo"
          required
        />
      </label>

      <label className="campo">
        <span>Captura del juego con el monto</span>
        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={elegir} />
      </label>

      {vistaPrevia && <img className="captura-previa" src={vistaPrevia} alt="Vista previa" />}
      {!vistaPrevia && inicial?.imagen && (
        <p className="forma-pie">Ya tiene una captura. Elige otra solo si quieres cambiarla.</p>
      )}

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

function Tarjeta({ d, mia, admin, onAccion, ocupado, onVerImagen }) {
  const [respuesta, setRespuesta] = useState('');
  const [decidiendo, setDecidiendo] = useState(null);
  const sinResolver = d.estado === 'borrador' || d.estado === 'pendiente';

  return (
    <article className={`soli dev-${d.estado}`}>
      <div className="soli-cabeza">
        <span className="dev-monto">{plata(d.monto)}</span>
        {!mia && <span className="soli-quien">{d.usuario}</span>}
        <span className={`soli-estado ${d.estado}`}>{ROTULO[d.estado]}</span>
      </div>

      <p className="soli-motivo">{d.descripcion}</p>

      {d.imagen ? (
        <button type="button" className="dev-captura" onClick={() => onVerImagen(d)}>
          <img src={`/api/devoluciones/${d.id}/imagen`} alt="Captura del monto" loading="lazy" />
          <span>Ver captura</span>
        </button>
      ) : (
        <p className="dev-sin-captura">Sin captura: no se puede enviar hasta adjuntarla.</p>
      )}

      {d.respuesta && (
        <p className="soli-respuesta">
          {d.resueltoPor}: «{d.respuesta}»
        </p>
      )}

      <div className="soli-acciones">
        {mia && d.estado === 'borrador' && (
          <button
            type="button"
            className="accion destacada"
            disabled={ocupado || !d.imagen}
            onClick={() => onAccion('enviar', d)}
          >
            Enviar
          </button>
        )}
        {mia && sinResolver && (
          <button type="button" className="accion" disabled={ocupado} onClick={() => onAccion('editar', d)}>
            Editar
          </button>
        )}
        {(mia && sinResolver) || admin ? (
          <button
            type="button"
            className="accion peligro"
            disabled={ocupado}
            onClick={() => onAccion('borrar', d)}
          >
            Eliminar
          </button>
        ) : null}

        {admin && d.estado === 'pendiente' && !decidiendo && (
          <>
            <button type="button" className="accion destacada" onClick={() => setDecidiendo('pagar')}>
              Marcar pagado
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
              decidiendo === 'pagar' ? 'Comentario (opcional)' : 'Motivo del rechazo (opcional)'
            }
            onChange={(e) => setRespuesta(e.target.value)}
          />
          <button
            type="button"
            className={`accion ${decidiendo === 'pagar' ? 'destacada' : 'peligro'}`}
            disabled={ocupado}
            onClick={() => {
              onAccion(decidiendo, d, respuesta);
              setDecidiendo(null);
              setRespuesta('');
            }}
          >
            Confirmar
          </button>
          <button type="button" className="accion" onClick={() => setDecidiendo(null)}>
            Cancelar
          </button>
        </div>
      )}
    </article>
  );
}

export default function Devoluciones({
  usuario,
  admin,
  miasIniciales,
  todasIniciales,
  turnoPropio,
  conStorage,
  fallo,
}) {
  const [mias, setMias] = useState(miasIniciales);
  const [todas, setTodas] = useState(todasIniciales);
  const [turno, setTurno] = useState(turnoPropio);
  const [creando, setCreando] = useState(false);
  const [editando, setEditando] = useState(null);
  const [viendo, setViendo] = useState(null);
  const [pestana, setPestana] = useState(admin ? 'pendientes' : 'mias');
  const [error, setError] = useState(fallo);
  const [aviso, setAviso] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const recargar = async () => {
    const [a, b] = await Promise.all([
      fetch('/api/devoluciones', { cache: 'no-store' }).then((r) => r.json()),
      admin
        ? fetch('/api/devoluciones?todas=1', { cache: 'no-store' }).then((r) => r.json())
        : Promise.resolve({ devoluciones: [] }),
    ]);
    if (a.devoluciones) setMias(a.devoluciones);
    if (b.devoluciones) setTodas(b.devoluciones);
  };

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

  const accion = (que, d, respuesta) => {
    if (que === 'editar') return setEditando(d.id);
    if (que === 'enviar') {
      return pedir(`/api/devoluciones/${d.id}`, json({ accion: 'enviar' }), 'Solicitud enviada.');
    }
    if (que === 'borrar') {
      if (!window.confirm('¿Eliminar esta solicitud? La captura también se borra.')) return;
      return pedir(`/api/devoluciones/${d.id}`, { method: 'DELETE' }, 'Solicitud eliminada.');
    }
    if (que === 'pagar' || que === 'rechazar') {
      return pedir(
        `/api/devoluciones/${d.id}`,
        json({ accion: que, respuesta }),
        que === 'pagar' ? 'Marcada como pagada. Se le avisó.' : 'Rechazada. Se le avisó.'
      );
    }
  };

  const pendientes = useMemo(() => todas.filter((d) => d.estado === 'pendiente'), [todas]);
  const resueltas = useMemo(() => todas.filter((d) => d.estado !== 'pendiente'), [todas]);
  const lista = pestana === 'mias' ? mias : pestana === 'pendientes' ? pendientes : resueltas;

  const porPagar = pendientes.reduce((s, d) => s + d.monto, 0);

  return (
    <>
      <Barra
        usuario={usuario}
        admin={admin}
        seccion="devoluciones"
        turno={turno}
        onTurnoCambio={setTurno}
      />
      <main className="envoltura">
        <header className="titulo">
          <div>
            <h1 className="titulo-texto">Devoluciones</h1>
            <p className="titulo-bajada">Plata que el taller debe reponer</p>
          </div>
          {!creando && (
            <button type="button" className="accion destacada" onClick={() => setCreando(true)}>
              Nueva solicitud
            </button>
          )}
        </header>

        {error && <p className="panel-error">{error}</p>}
        {aviso && <p className="mecanicos-aviso">{aviso}</p>}

        {!conStorage && (
          <p className="panel-aviso">
            Las capturas se están guardando en el disco de este servidor. En Vercel eso se
            borra en cada despliegue: falta crear el bucket <code>sunset</code> en Supabase
            Storage.
          </p>
        )}

        {creando && (
          <section className="soli-nueva">
            <h2 className="ref-titulo">Nueva devolución</h2>
            <Formulario
              ocupado={ocupado}
              onCancelar={() => setCreando(false)}
              onGuardar={(forma) =>
                pedir(
                  '/api/devoluciones',
                  { method: 'POST', body: forma },
                  'Borrador guardado. Revísalo y pulsa «Enviar».'
                ).then((ok) => ok && setCreando(false))
              }
            />
            <p className="forma-pie">
              Adjunta la captura del juego donde se vea el monto que pagaste. Sin ella no se
              puede enviar: es la prueba de lo que se te debe.
            </p>
          </section>
        )}

        {admin && (
          <div className="pestanas">
            <button
              type="button"
              className={`pestana ${pestana === 'pendientes' ? 'activa' : ''}`}
              onClick={() => setPestana('pendientes')}
            >
              Por pagar
              {pendientes.length > 0 && <span className="pestana-cuenta">{pendientes.length}</span>}
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

        {admin && pestana === 'pendientes' && pendientes.length > 0 && (
          <div className="surtidor dev-total">
            <div className="surtidor-fila">
              <span className="surtidor-rotulo">Total por devolver</span>
              <span className="surtidor-cifra">{plata(porPagar)}</span>
            </div>
          </div>
        )}

        {lista.length === 0 ? (
          <p className="vacio">
            {pestana === 'pendientes'
              ? 'No hay devoluciones esperando pago.'
              : pestana === 'resueltas'
                ? 'Todavía no has resuelto ninguna.'
                : 'No tienes solicitudes. Crea una con «Nueva solicitud».'}
          </p>
        ) : (
          <div className="soli-lista">
            {lista.map((d) =>
              editando === d.id ? (
                <section className="soli-nueva" key={d.id}>
                  <h2 className="ref-titulo">Editando</h2>
                  <Formulario
                    inicial={d}
                    ocupado={ocupado}
                    onCancelar={() => setEditando(null)}
                    onGuardar={(forma) =>
                      pedir(
                        `/api/devoluciones/${d.id}`,
                        { method: 'PATCH', body: forma },
                        'Solicitud actualizada.'
                      ).then((ok) => ok && setEditando(null))
                    }
                  />
                </section>
              ) : (
                <Tarjeta
                  key={d.id}
                  d={d}
                  mia={d.usuario === usuario}
                  admin={admin && pestana !== 'mias'}
                  ocupado={ocupado}
                  onAccion={accion}
                  onVerImagen={setViendo}
                />
              )
            )}
          </div>
        )}

        <p className="pie">
          Las capturas se guardan en privado: solo las ve quien subió la solicitud y el
          encargado. Nadie más puede abrirlas ni con el enlace.
        </p>
      </main>

      {viendo && (
        <Dialogo titulo={`Captura · ${plata(viendo.monto)}`} onCerrar={() => setViendo(null)}>
          <img
            className="captura-grande"
            src={`/api/devoluciones/${viendo.id}/imagen`}
            alt="Captura del monto pagado"
          />
        </Dialogo>
      )}
    </>
  );
}
