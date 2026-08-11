'use client';

import { useMemo, useState } from 'react';
import Barra from '../barra';
import Mecanicos from './mecanicos';
import Discord from './discord';
import {
  diaCorto,
  diaISO,
  desdeInput,
  duracionMs,
  enHoras,
  paraInput,
  soloFecha,
  soloHora,
} from '../../lib/tiempo';

function Fila({ turno, editando, onEditar, onCancelar, onGuardar, onBorrar, ocupado }) {
  const [entrada, setEntrada] = useState(paraInput(turno.entrada));
  const [salida, setSalida] = useState(paraInput(turno.salida));
  const [nota, setNota] = useState(turno.nota ?? '');

  if (editando) {
    return (
      <tr className="fila-edicion">
        <td data-rotulo="Usuario">{turno.usuario}</td>
        <td data-rotulo="Entrada">
          <input
            type="datetime-local"
            value={entrada}
            onChange={(e) => setEntrada(e.target.value)}
          />
        </td>
        <td data-rotulo="Salida">
          <input
            type="datetime-local"
            value={salida}
            onChange={(e) => setSalida(e.target.value)}
          />
          {salida && (
            <button type="button" className="mini" onClick={() => setSalida('')}>
              dejar abierto
            </button>
          )}
        </td>
        <td data-rotulo="Nota" colSpan={2}>
          <input
            type="text"
            value={nota}
            placeholder="Motivo de la corrección"
            maxLength={120}
            onChange={(e) => setNota(e.target.value)}
          />
          {turno.corregido && (
            <span className="edicion-previa">Corregido antes por {turno.corregido}</span>
          )}
        </td>
        <td data-rotulo="">
          <span className="fila-acciones">
            <button
              type="button"
              className="accion"
              disabled={ocupado}
              onClick={() =>
                onGuardar(turno.id, {
                  entrada: desdeInput(entrada),
                  salida: salida ? desdeInput(salida) : null,
                  nota,
                })
              }
            >
              Guardar
            </button>
            <button type="button" className="accion" onClick={onCancelar}>
              Cancelar
            </button>
          </span>
        </td>
      </tr>
    );
  }

  const abierto = !turno.salida;

  return (
    <tr className={abierto ? 'abierto' : ''}>
      <td data-rotulo="Usuario">
        <span className="celda-usuario">{turno.usuario}</span>
        {turno.corregido && <span className="marca-corregido">corregido</span>}
        {turno.cerradoAuto && <span className="marca-auto">cerrado solo</span>}
        {/* El motivo se muestra escrito, no escondido en un tooltip: es la explicación de
            por qué las horas de alguien no son las que marcó, y tiene que poder leerse. */}
        {turno.corregido && (
          <span className="celda-motivo">
            {turno.nota ? `«${turno.nota}»` : 'sin motivo anotado'} — {turno.corregido}
          </span>
        )}
      </td>
      <td data-rotulo="Fecha">
        <span className="celda-dia">{diaCorto(turno.entrada)}</span> {soloFecha(turno.entrada)}
      </td>
      <td data-rotulo="Entrada">{soloHora(turno.entrada)}</td>
      <td data-rotulo="Salida">
        {abierto ? <span className="aun-dentro">en turno</span> : soloHora(turno.salida)}
      </td>
      <td data-rotulo="Horas">{enHoras(duracionMs(turno))}</td>
      <td data-rotulo="">
        <span className="fila-acciones">
          <button type="button" className="accion" onClick={() => onEditar(turno.id)}>
            Corregir
          </button>
          <button
            type="button"
            className="accion peligro"
            disabled={ocupado}
            onClick={() => onBorrar(turno.id)}
          >
            Borrar
          </button>
        </span>
      </td>
    </tr>
  );
}

export default function Panel({
  turnosIniciales,
  usuariosIniciales,
  turnoPropio,
  configInicial,
  almacen,
  fallo,
  quienSoy,
}) {
  const [turnos, setTurnos] = useState(turnosIniciales);
  const [miTurno, setMiTurno] = useState(turnoPropio);
  const [quien, setQuien] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [editando, setEditando] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState(fallo);

  const recargar = async () => {
    const r = await fetch('/api/turnos', { cache: 'no-store' });
    const cuerpo = await r.json().catch(() => ({}));
    if (!r.ok) {
      setError(cuerpo.error || 'No se pudo recargar.');
      return;
    }
    setTurnos(cuerpo.turnos);
    setError('');
  };

  const guardar = async (id, cambios) => {
    setOcupado(true);
    setError('');
    try {
      const r = await fetch(`/api/turnos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cambios),
      });
      const cuerpo = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(cuerpo.error || 'No se pudo guardar.');
        return;
      }
      setEditando(null);
      await recargar();
    } finally {
      setOcupado(false);
    }
  };

  const borrar = async (id) => {
    const t = turnos.find((x) => x.id === id);
    const cuando = t ? `${soloFecha(t.entrada)} ${soloHora(t.entrada)}` : '';
    if (!window.confirm(`¿Borrar el turno de ${t?.usuario} del ${cuando}? No se puede deshacer.`)) {
      return;
    }
    setOcupado(true);
    setError('');
    try {
      const r = await fetch(`/api/turnos/${id}`, { method: 'DELETE' });
      const cuerpo = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(cuerpo.error || 'No se pudo borrar.');
        return;
      }
      await recargar();
    } finally {
      setOcupado(false);
    }
  };

  const filtrados = useMemo(
    () =>
      turnos.filter((t) => {
        if (quien && t.usuario !== quien) return false;
        const dia = diaISO(t.entrada);
        if (desde && dia < desde) return false;
        if (hasta && dia > hasta) return false;
        return true;
      }),
    [turnos, quien, desde, hasta]
  );

  const resumen = useMemo(() => {
    const porUsuario = new Map();
    for (const t of filtrados) {
      const previo = porUsuario.get(t.usuario) ?? { ms: 0, turnos: 0, abiertos: 0 };
      porUsuario.set(t.usuario, {
        ms: previo.ms + duracionMs(t),
        turnos: previo.turnos + 1,
        abiertos: previo.abiertos + (t.salida ? 0 : 1),
      });
    }
    return [...porUsuario.entries()].sort((a, b) => b[1].ms - a[1].ms);
  }, [filtrados]);

  const totalMs = filtrados.reduce((suma, t) => suma + duracionMs(t), 0);
  const enTurno = filtrados.filter((t) => !t.salida).length;
  const hayFiltro = quien || desde || hasta;

  return (
    <>
      <Barra
        usuario={quienSoy}
        admin
        seccion="registro"
        turno={miTurno}
        onTurnoCambio={(t) => {
          setMiTurno(t);
          // Marcar desde el menú cambia el registro que se está mirando: hay que releerlo.
          recargar();
        }}
      />
      <main className="envoltura">
        <header className="titulo">
          <div>
            <h1 className="titulo-texto">Registro de turnos</h1>
            <p className="titulo-bajada">
              Entradas y salidas ·{' '}
              {
                {
                  supabase: 'guardado en Supabase',
                  redis: 'guardado en Redis',
                  archivo: 'guardado en archivo local',
                }[almacen]
              }
            </p>
          </div>
          <button type="button" className="accion" onClick={recargar}>
            Recargar
          </button>
        </header>

        {error && <p className="panel-error">{error}</p>}

        {almacen === 'archivo' && (
          <p className="panel-aviso">
            Guardando en <code>.datos/</code>, en el disco de este servidor. En Vercel ese
            disco se borra en cada despliegue: conecta Supabase antes de usarlo en serio.
          </p>
        )}

        <div className="filtros">
          <label className="campo-inline">
            <span>Mecánico</span>
            <select value={quien} onChange={(e) => setQuien(e.target.value)}>
              <option value="">Todos</option>
              {usuariosIniciales.map((u) => (
                <option key={u.usuario} value={u.usuario}>
                  {u.usuario}
                </option>
              ))}
            </select>
          </label>
          <label className="campo-inline">
            <span>Desde</span>
            <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
          </label>
          <label className="campo-inline">
            <span>Hasta</span>
            <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </label>
          {hayFiltro && (
            <button
              type="button"
              className="accion"
              onClick={() => {
                setQuien('');
                setDesde('');
                setHasta('');
              }}
            >
              Quitar filtros
            </button>
          )}
        </div>

        {resumen.length > 0 && (
          <div className="resumen">
            {resumen.map(([usuario, r]) => (
              <div className="resumen-ficha" key={usuario}>
                <span className="resumen-usuario">{usuario}</span>
                <span className="resumen-horas">{enHoras(r.ms)}</span>
                <span className="resumen-detalle">
                  {r.turnos} turno{r.turnos > 1 ? 's' : ''}
                  {r.abiertos > 0 && ' · en turno ahora'}
                </span>
              </div>
            ))}
          </div>
        )}

        {filtrados.length === 0 ? (
          <p className="vacio">
            {turnos.length === 0
              ? 'Todavía no hay turnos registrados.'
              : 'Ningún turno cae dentro de esos filtros.'}
          </p>
        ) : (
          <div className="tabla-envoltura">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Mecánico</th>
                  <th>Fecha</th>
                  <th>Entrada</th>
                  <th>Salida</th>
                  <th>Horas</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtrados.map((t) => (
                  <Fila
                    key={`${t.id}:${t.entrada}:${t.salida}`}
                    turno={t}
                    editando={editando === t.id}
                    ocupado={ocupado}
                    onEditar={setEditando}
                    onCancelar={() => setEditando(null)}
                    onGuardar={guardar}
                    onBorrar={borrar}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="surtidor">
          <div className="surtidor-fila">
            <span className="surtidor-rotulo">Total de horas</span>
            <span className="surtidor-cifra">{enHoras(totalMs)}</span>
          </div>
          <div className="surtidor-detalle">
            <span>
              {filtrados.length} turno{filtrados.length === 1 ? '' : 's'}
              {enTurno > 0 && ` · ${enTurno} en el taller ahora`}
              {hayFiltro && ' · filtrado'}
            </span>
          </div>
        </div>

        <Mecanicos iniciales={usuariosIniciales} quienSoy={quienSoy} />

        <Discord inicial={configInicial} />

        <p className="pie">
          Las horas se muestran en hora de Chile. Un turno abierto suma hasta este momento,
          así que su total sigue creciendo mientras la persona no marque salida.
        </p>
      </main>
    </>
  );
}
