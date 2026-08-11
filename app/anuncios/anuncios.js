'use client';

import { useState } from 'react';
import Barra from '../barra';
import Dialogo from '../dialogo';

/** Copia al portapapeles, con respaldo para navegadores que lo bloquean. */
async function copiar(texto) {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    window.prompt('Copia el mensaje desde aquí:', texto);
    return false;
  }
}

function Mensaje({ m, admin, onBorrar, onEditar, ocupado }) {
  const [copiado, setCopiado] = useState(false);

  return (
    <article className="msj">
      <div className="msj-cabeza">
        <h3 className="msj-titulo">{m.titulo}</h3>
        <button
          type="button"
          className={`accion ${copiado ? 'destacada' : ''}`}
          onClick={async () => {
            const ok = await copiar(m.texto);
            if (!ok) return;
            setCopiado(true);
            setTimeout(() => setCopiado(false), 1800);
          }}
        >
          {copiado ? 'Copiado' : 'Copiar'}
        </button>
      </div>

      <pre className="msj-texto">{m.texto}</pre>

      {admin && (
        <div className="soli-acciones">
          <button type="button" className="accion" disabled={ocupado} onClick={() => onEditar(m)}>
            Editar
          </button>
          <button
            type="button"
            className="accion peligro"
            disabled={ocupado}
            onClick={() => onBorrar(m)}
          >
            Eliminar
          </button>
        </div>
      )}
    </article>
  );
}

export default function Anuncios({
  usuario,
  admin,
  flyersIniciales,
  mensajesIniciales,
  turnoPropio,
  conStorage,
  fallo,
}) {
  const [flyers, setFlyers] = useState(flyersIniciales);
  const [mensajes, setMensajes] = useState(mensajesIniciales);
  const [turno, setTurno] = useState(turnoPropio);
  const [viendo, setViendo] = useState(null);
  const [error, setError] = useState(fallo);
  const [aviso, setAviso] = useState('');
  const [ocupado, setOcupado] = useState(false);

  // Formularios del administrador
  const [subiendo, setSubiendo] = useState(false);
  const [tituloFlyer, setTituloFlyer] = useState('');
  const [archivo, setArchivo] = useState(null);
  const [previa, setPrevia] = useState(null);
  const [escribiendo, setEscribiendo] = useState(false);
  const [editando, setEditando] = useState(null);
  const [tituloMsj, setTituloMsj] = useState('');
  const [textoMsj, setTextoMsj] = useState('');

  const recargar = async () => {
    const [f, m] = await Promise.all([
      fetch('/api/flyers', { cache: 'no-store' }).then((r) => r.json()),
      fetch('/api/anuncios', { cache: 'no-store' }).then((r) => r.json()),
    ]);
    if (f.flyers) setFlyers(f.flyers);
    if (m.mensajes) setMensajes(m.mensajes);
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

  const publicarFlyer = async (e) => {
    e.preventDefault();
    const forma = new FormData();
    forma.set('titulo', tituloFlyer);
    if (archivo) forma.set('imagen', archivo);
    const ok = await pedir('/api/flyers', { method: 'POST', body: forma }, 'Flyer publicado.');
    if (ok) {
      setSubiendo(false);
      setTituloFlyer('');
      setArchivo(null);
      setPrevia(null);
    }
  };

  const guardarMensaje = async (e) => {
    e.preventDefault();
    const cuerpo = {
      method: editando ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ titulo: tituloMsj, texto: textoMsj }),
    };
    const url = editando ? `/api/anuncios/${editando}` : '/api/anuncios';
    const ok = await pedir(url, cuerpo, editando ? 'Mensaje actualizado.' : 'Mensaje guardado.');
    if (ok) {
      setEscribiendo(false);
      setEditando(null);
      setTituloMsj('');
      setTextoMsj('');
    }
  };

  return (
    <>
      <Barra
        usuario={usuario}
        admin={admin}
        seccion="anuncios"
        turno={turno}
        onTurnoCambio={setTurno}
      />
      <main className="envoltura">
        <header className="titulo">
          <div>
            <h1 className="titulo-texto">Anuncios</h1>
            <p className="titulo-bajada">Flyers y mensajes del taller</p>
          </div>
        </header>

        {error && <p className="panel-error">{error}</p>}
        {aviso && <p className="mecanicos-aviso">{aviso}</p>}

        {admin && !conStorage && (
          <p className="panel-aviso">
            Los flyers se están guardando en el disco de este servidor. En Vercel eso se borra
            en cada despliegue: falta el bucket <code>sunset</code> en Supabase Storage.
          </p>
        )}

        {/* ---------- Flyers ---------- */}

        <section className="bloque">
          <div className="bloque-cabeza">
            <h2 className="ref-titulo">Flyers</h2>
            {admin && !subiendo && (
              <button type="button" className="accion destacada" onClick={() => setSubiendo(true)}>
                Subir flyer
              </button>
            )}
          </div>

          {admin && subiendo && (
            <form className="soli-nueva soli-forma" onSubmit={publicarFlyer}>
              <label className="campo">
                <span>Título</span>
                <input
                  value={tituloFlyer}
                  onChange={(e) => setTituloFlyer(e.target.value)}
                  maxLength={80}
                  placeholder="Promoción de frenos"
                  required
                />
              </label>
              <label className="campo">
                <span>Imagen del flyer</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    setArchivo(f);
                    setPrevia(f ? URL.createObjectURL(f) : null);
                  }}
                  required
                />
              </label>
              {previa && <img className="captura-previa" src={previa} alt="Vista previa" />}
              <div className="soli-botones">
                <button type="submit" className="accion" disabled={ocupado}>
                  {ocupado ? 'Publicando…' : 'Publicar'}
                </button>
                <button type="button" className="accion" onClick={() => setSubiendo(false)}>
                  Cancelar
                </button>
              </div>
            </form>
          )}

          {flyers.length === 0 ? (
            <p className="vacio">
              {admin ? 'Todavía no hay flyers. Sube el primero.' : 'Todavía no hay flyers.'}
            </p>
          ) : (
            <div className="galeria">
              {flyers.map((f) => (
                <figure className="flyer" key={f.id}>
                  <button
                    type="button"
                    className="flyer-marco"
                    onClick={() => setViendo(f)}
                    aria-label={`Ver ${f.titulo}`}
                  >
                    <img src={`/api/flyers/${f.id}/imagen`} alt={f.titulo} loading="lazy" />
                    <span className="flyer-brillo" aria-hidden="true" />
                  </button>
                  <figcaption className="flyer-pie">
                    <span className="flyer-titulo">{f.titulo}</span>
                    <span className="flyer-autor">{f.creadoPor}</span>
                  </figcaption>
                  {admin && (
                    <div className="flyer-acciones">
                      <a className="accion" href={`/api/flyers/${f.id}/imagen`} download>
                        Descargar
                      </a>
                      <button
                        type="button"
                        className="accion peligro"
                        disabled={ocupado}
                        onClick={() => {
                          if (!window.confirm(`¿Eliminar el flyer «${f.titulo}»?`)) return;
                          pedir(`/api/flyers/${f.id}`, { method: 'DELETE' }, 'Flyer eliminado.');
                        }}
                      >
                        Eliminar
                      </button>
                    </div>
                  )}
                </figure>
              ))}
            </div>
          )}
        </section>

        {/* ---------- Mensajes ---------- */}

        <section className="bloque">
          <div className="bloque-cabeza">
            <h2 className="ref-titulo">Mensajes listos para copiar</h2>
            {admin && !escribiendo && (
              <button
                type="button"
                className="accion destacada"
                onClick={() => {
                  setEscribiendo(true);
                  setEditando(null);
                  setTituloMsj('');
                  setTextoMsj('');
                }}
              >
                Nuevo mensaje
              </button>
            )}
          </div>

          {admin && escribiendo && (
            <form className="soli-nueva soli-forma" onSubmit={guardarMensaje}>
              <label className="campo">
                <span>Título</span>
                <input
                  value={tituloMsj}
                  onChange={(e) => setTituloMsj(e.target.value)}
                  maxLength={80}
                  placeholder="Anuncio de apertura"
                  required
                />
              </label>
              <label className="campo">
                <span>Mensaje</span>
                <textarea
                  value={textoMsj}
                  onChange={(e) => setTextoMsj(e.target.value)}
                  rows={5}
                  maxLength={2000}
                  placeholder="El texto tal cual lo van a pegar en el anuncio del juego"
                  required
                />
              </label>
              <div className="soli-botones">
                <button type="submit" className="accion" disabled={ocupado}>
                  {ocupado ? 'Guardando…' : editando ? 'Guardar cambios' : 'Guardar mensaje'}
                </button>
                <button
                  type="button"
                  className="accion"
                  onClick={() => {
                    setEscribiendo(false);
                    setEditando(null);
                  }}
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}

          {mensajes.length === 0 ? (
            <p className="vacio">
              {admin
                ? 'Todavía no hay mensajes guardados. Crea el primero.'
                : 'Todavía no hay mensajes guardados.'}
            </p>
          ) : (
            <div className="msj-lista">
              {mensajes.map((m) => (
                <Mensaje
                  key={m.id}
                  m={m}
                  admin={admin}
                  ocupado={ocupado}
                  onEditar={(x) => {
                    setEscribiendo(true);
                    setEditando(x.id);
                    setTituloMsj(x.titulo);
                    setTextoMsj(x.texto);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  onBorrar={(x) => {
                    if (!window.confirm(`¿Eliminar el mensaje «${x.titulo}»?`)) return;
                    pedir(`/api/anuncios/${x.id}`, { method: 'DELETE' }, 'Mensaje eliminado.');
                  }}
                />
              ))}
            </div>
          )}
        </section>

        <p className="pie">
          Los flyers y los mensajes los publica el encargado. Todo el taller puede verlos y
          copiar los textos para pegarlos en los anuncios del juego.
        </p>
      </main>

      {viendo && (
        <Dialogo titulo={viendo.titulo} onCerrar={() => setViendo(null)}>
          <img className="captura-grande" src={`/api/flyers/${viendo.id}/imagen`} alt={viendo.titulo} />
          <p className="forma-pie">
            Publicado por {viendo.creadoPor}.{' '}
            <a className="enlace" href={`/api/flyers/${viendo.id}/imagen`} download>
              Descargar imagen
            </a>
          </p>
        </Dialogo>
      )}
    </>
  );
}
