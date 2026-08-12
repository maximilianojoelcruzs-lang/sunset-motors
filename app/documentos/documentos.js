'use client';

import { useMemo, useState } from 'react';
import Barra from '../barra';
import Dialogo from '../dialogo';
import { soloFecha } from '../../lib/tiempo';

/**
 * Solo sugerencias del formulario: la categoría es texto libre. No se importan de
 * lib/documentos.js porque ese módulo usa node:fs y este componente corre en el navegador.
 */
const CATEGORIAS_SUGERIDAS = ['Reglamento', 'Contratos', 'Manuales', 'Acuerdos', 'Formularios'];

const limpiar = (s) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const peso = (bytes) => {
  if (!bytes) return '';
  const kb = bytes / 1024;
  return kb < 1024 ? `${Math.round(kb)} kB` : `${(kb / 1024).toFixed(1)} MB`;
};

const esPdf = (d) => d.tipo === 'application/pdf';

function Ficha({ d, admin, onVer, onEditar, onBorrar, ocupado }) {
  return (
    <article className="doc">
      <span className={`doc-icono ${esPdf(d) ? 'pdf' : 'img'}`} aria-hidden="true">
        {esPdf(d) ? 'PDF' : 'IMG'}
      </span>

      <div className="doc-texto">
        <h3 className="doc-titulo">{d.titulo}</h3>
        {d.descripcion && <p className="doc-descripcion">{d.descripcion}</p>}
        <p className="doc-meta">
          {d.creadoPor} · {soloFecha(d.creado)}
          {d.tamano ? ` · ${peso(d.tamano)}` : ''}
        </p>
      </div>

      <div className="doc-acciones">
        <button type="button" className="accion" onClick={() => onVer(d)}>
          Abrir
        </button>
        <a className="accion" href={`/api/documentos/${d.id}/archivo`} download>
          Descargar
        </a>
        {admin && (
          <>
            <button type="button" className="accion" disabled={ocupado} onClick={() => onEditar(d)}>
              Editar
            </button>
            <button
              type="button"
              className="accion peligro"
              disabled={ocupado}
              onClick={() => onBorrar(d)}
            >
              Eliminar
            </button>
          </>
        )}
      </div>
    </article>
  );
}

export default function Documentos({
  usuario,
  admin,
  accesos,
  iniciales,
  turnoPropio,
  conStorage,
  fallo,
}) {
  const [documentos, setDocumentos] = useState(iniciales);
  const [turno, setTurno] = useState(turnoPropio);
  const [filtro, setFiltro] = useState('');
  const [viendo, setViendo] = useState(null);
  const [subiendo, setSubiendo] = useState(false);
  const [editando, setEditando] = useState(null);
  const [error, setError] = useState(fallo);
  const [aviso, setAviso] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [categoria, setCategoria] = useState('');
  const [archivo, setArchivo] = useState(null);

  const limpiarFormulario = () => {
    setSubiendo(false);
    setEditando(null);
    setTitulo('');
    setDescripcion('');
    setCategoria('');
    setArchivo(null);
  };

  const recargar = async () => {
    const r = await fetch('/api/documentos', { cache: 'no-store' });
    const cuerpo = await r.json().catch(() => ({}));
    if (r.ok) setDocumentos(cuerpo.documentos);
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

  const enviar = async (e) => {
    e.preventDefault();

    if (editando) {
      const ok = await pedir(
        `/api/documentos/${editando}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ titulo, descripcion, categoria }),
        },
        'Documento actualizado.'
      );
      if (ok) limpiarFormulario();
      return;
    }

    const forma = new FormData();
    forma.set('titulo', titulo);
    forma.set('descripcion', descripcion);
    forma.set('categoria', categoria);
    if (archivo) forma.set('archivo', archivo);
    const ok = await pedir('/api/documentos', { method: 'POST', body: forma }, 'Documento publicado.');
    if (ok) limpiarFormulario();
  };

  const busqueda = limpiar(filtro.trim());

  const porCategoria = useMemo(() => {
    const visibles = documentos.filter(
      (d) =>
        !busqueda ||
        limpiar(d.titulo).includes(busqueda) ||
        limpiar(d.descripcion).includes(busqueda) ||
        limpiar(d.categoria).includes(busqueda)
    );
    const grupos = new Map();
    for (const d of visibles) {
      if (!grupos.has(d.categoria)) grupos.set(d.categoria, []);
      grupos.get(d.categoria).push(d);
    }
    return [...grupos.entries()];
  }, [documentos, busqueda]);

  // Las que ya se usan, más las sugeridas, sin repetir.
  const categorias = useMemo(
    () => [...new Set([...documentos.map((d) => d.categoria), ...CATEGORIAS_SUGERIDAS])],
    [documentos]
  );

  return (
    <>
      <Barra
        usuario={usuario}
        admin={admin}
        accesos={accesos}
        seccion="documentos"
        turno={turno}
        onTurnoCambio={setTurno}
      />
      <main className="envoltura">
        <header className="titulo">
          <div>
            <h1 className="titulo-texto">Documentos</h1>
            <p className="titulo-bajada">Reglamento, contratos y manuales del taller</p>
          </div>
          {admin && !subiendo && !editando && (
            <button type="button" className="accion destacada" onClick={() => setSubiendo(true)}>
              Subir documento
            </button>
          )}
        </header>

        {error && <p className="panel-error">{error}</p>}
        {aviso && <p className="mecanicos-aviso">{aviso}</p>}

        {admin && !conStorage && (
          <p className="panel-aviso">
            Los documentos se están guardando en el disco de este servidor. En Vercel eso se
            borra en cada despliegue: falta el bucket <code>sunset</code> en Supabase Storage.
          </p>
        )}

        {admin && (subiendo || editando) && (
          <form className="soli-nueva soli-forma" onSubmit={enviar}>
            <h2 className="ref-titulo">{editando ? 'Editando documento' : 'Documento nuevo'}</h2>

            <label className="campo">
              <span>Título</span>
              <input
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                maxLength={90}
                placeholder="Reglamento interno del taller"
                required
              />
            </label>

            <label className="campo">
              <span>Categoría</span>
              <input
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                maxLength={40}
                list="categorias"
                placeholder="Reglamento, Contratos, Manuales…"
              />
              <datalist id="categorias">
                {categorias.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </label>

            <label className="campo">
              <span>Descripción (opcional)</span>
              <textarea
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                rows={2}
                maxLength={300}
                placeholder="De qué trata, o cuándo aplica"
              />
            </label>

            {!editando && (
              <label className="campo">
                <span>Archivo (PDF o imagen)</span>
                <input
                  type="file"
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
                  required
                />
              </label>
            )}
            {editando && (
              <p className="forma-pie">
                El archivo no se cambia desde acá. Si cambió el documento, sube uno nuevo y
                elimina el viejo.
              </p>
            )}

            <div className="soli-botones">
              <button type="submit" className="accion destacada" disabled={ocupado}>
                {ocupado ? 'Guardando…' : editando ? 'Guardar cambios' : 'Publicar'}
              </button>
              <button type="button" className="accion" onClick={limpiarFormulario}>
                Cancelar
              </button>
            </div>
          </form>
        )}

        {documentos.length > 0 && (
          <div className="buscador">
            <input
              type="search"
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              placeholder="Buscar documento…"
              aria-label="Buscar documento"
            />
          </div>
        )}

        {porCategoria.length === 0 ? (
          <p className="vacio">
            {documentos.length === 0
              ? admin
                ? 'Todavía no hay documentos. Sube el primero.'
                : 'Todavía no hay documentos.'
              : `Ningún documento coincide con «${filtro}».`}
          </p>
        ) : (
          porCategoria.map(([cat, lista]) => (
            <section className="bloque" key={cat}>
              <h2 className="ref-titulo">
                {cat} <span className="doc-cuenta">{lista.length}</span>
              </h2>
              <div className="doc-lista">
                {lista.map((d) => (
                  <Ficha
                    key={d.id}
                    d={d}
                    admin={admin}
                    ocupado={ocupado}
                    onVer={setViendo}
                    onEditar={(x) => {
                      setSubiendo(false);
                      setEditando(x.id);
                      setTitulo(x.titulo);
                      setDescripcion(x.descripcion);
                      setCategoria(x.categoria);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    onBorrar={(x) => {
                      if (!window.confirm(`¿Eliminar «${x.titulo}»? También se borra el archivo.`)) {
                        return;
                      }
                      pedir(`/api/documentos/${x.id}`, { method: 'DELETE' }, 'Documento eliminado.');
                    }}
                  />
                ))}
              </div>
            </section>
          ))
        )}

        <p className="pie">
          Los documentos los publica el encargado y los consulta todo el taller. Se guardan en
          privado: hace falta tener sesión para abrirlos, aunque se tenga el enlace.
        </p>
      </main>

      {viendo && (
        <Dialogo titulo={viendo.titulo} onCerrar={() => setViendo(null)}>
          {esPdf(viendo) ? (
            <iframe
              className="doc-visor"
              src={`/api/documentos/${viendo.id}/archivo`}
              title={viendo.titulo}
            />
          ) : (
            <img
              className="captura-grande"
              src={`/api/documentos/${viendo.id}/archivo`}
              alt={viendo.titulo}
            />
          )}
          <p className="forma-pie">
            {viendo.descripcion && <>{viendo.descripcion}<br /></>}
            <a className="enlace" href={`/api/documentos/${viendo.id}/archivo`} download>
              Descargar
            </a>
          </p>
        </Dialogo>
      )}
    </>
  );
}
