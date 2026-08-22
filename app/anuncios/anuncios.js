'use client';

import { useState } from 'react';
import Barra from '../barra';
import Popups from './popups';
import useSondeo from '../sondeo';
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

/**
 * De dónde sale la imagen de un flyer.
 *
 * Los nuevos traen `enlace` —se pega la URL— y los publicados antes de ese cambio tienen su
 * archivo en el bucket, que sigue sirviéndose por la ruta de siempre. Con esto los dos se ven
 * en la misma galería y no hay que migrar nada.
 */
const fuenteDeFlyer = (f) => f.enlace || `/api/flyers/${f.id}/imagen`;

/**
 * Una tarjeta de la galería.
 *
 * Es su propio componente por el «Copiado»: con el estado en la pantalla, copiar una URL
 * marcaría las diez tarjetas a la vez.
 */
function Flyer({ f, admin, onVer, onBorrar, ocupado }) {
  const [copiado, setCopiado] = useState(false);

  // Los flyers nuevos traen la URL pegada; los antiguos, su archivo servido por la app —y esa
  // ruta es relativa, así que se completa con el dominio para que sirva de algo al pegarla.
  const url = f.enlace || new URL(`/api/flyers/${f.id}/imagen`, window.location.origin).toString();

  return (
    <figure className="flyer">
      <button
        type="button"
        className="flyer-marco"
        onClick={() => onVer(f)}
        aria-label={`Ver ${f.titulo}`}
      >
        <img src={fuenteDeFlyer(f)} alt={f.titulo} loading="lazy" />
        <span className="flyer-brillo" aria-hidden="true" />
      </button>

      <figcaption className="flyer-pie">
        <span className="flyer-titulo">{f.titulo}</span>
        <span className="flyer-autor">{f.creadoPor}</span>
      </figcaption>

      <div className="flyer-acciones">
        {/* De cualquiera, no solo del encargado: el enlace es justo lo que se pega en Discord
            o en el anuncio del juego. */}
        <button
          type="button"
          className={`accion ${copiado ? 'destacada' : ''}`}
          onClick={async () => {
            const ok = await copiar(url);
            if (!ok) return;
            setCopiado(true);
            setTimeout(() => setCopiado(false), 1800);
          }}
        >
          {copiado ? 'URL copiada' : 'Copiar URL'}
        </button>

        <a className="accion" href={url} target="_blank" rel="noreferrer">
          Abrir
        </a>

        {admin && (
          <button
            type="button"
            className="accion peligro"
            disabled={ocupado}
            onClick={() => onBorrar(f)}
          >
            Eliminar
          </button>
        )}
      </div>
    </figure>
  );
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
  accesos,
  flyersIniciales,
  mensajesIniciales,
  turnoPropio,
  conStorage,
  fallo,
}) {
  const [flyers, setFlyers] = useState(flyersIniciales);
  const [enlace, setEnlace] = useState('');
  const [mensajes, setMensajes] = useState(mensajesIniciales);
  const [turno, setTurno] = useState(turnoPropio);
  const [viendo, setViendo] = useState(null);
  const [error, setError] = useState(fallo);
  const [aviso, setAviso] = useState('');
  const [ocupado, setOcupado] = useState(false);

  // Formularios del administrador
  const [subiendo, setSubiendo] = useState(false);
  const [tituloFlyer, setTituloFlyer] = useState('');
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

  // La pantalla se pone al día sola: nadie tiene que apretar F5 para ver lo que llegó.
  useSondeo(recargar, 30000);

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
    const ok = await pedir(
      '/api/flyers',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titulo: tituloFlyer, enlace }),
      },
      'Flyer publicado.'
    );
    if (ok) {
      setSubiendo(false);
      setTituloFlyer('');
      setEnlace('');
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
        accesos={accesos}
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

        {/* El bucket ya no hace falta para publicar: las imágenes son enlaces pegados. Solo
            se avisa si hay flyers antiguos con archivo guardado, que son los que dependen de él. */}
        {admin && !conStorage && flyers.some((f) => !f.enlace) && (
          <p className="panel-aviso">
            Hay flyers publicados antes, con la imagen guardada en el disco de este servidor. En
            Vercel ese disco se borra en cada despliegue: falta el bucket <code>sunset</code> en
            Supabase Storage. Los flyers nuevos no lo necesitan.
          </p>
        )}

        {/* ---------- Flyers ---------- */}

        <section className="bloque">
          <div className="bloque-cabeza">
            <h2 className="ref-titulo">Flyers</h2>
            {admin && !subiendo && (
              <button type="button" className="accion destacada" onClick={() => setSubiendo(true)}>
                Publicar flyer
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
                <span>Enlace de la imagen</span>
                <input
                  value={enlace}
                  onChange={(e) => setEnlace(e.target.value)}
                  placeholder="https://…/flyer.png"
                  inputMode="url"
                  required
                />
              </label>
              <p className="tun-ayuda">
                Pega la URL de la imagen: la que sale al subirla a Discord, a Imgur o la que deja
                FiveM. La carga el navegador de quien mira la galería, así que tiene que ser un
                enlace que se abra sin contraseña.
              </p>
              {enlace.trim() && (
                <img
                  className="captura-previa"
                  src={enlace.trim()}
                  alt="Vista previa"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              )}
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
                <Flyer
                  key={f.id}
                  f={f}
                  admin={admin}
                  ocupado={ocupado}
                  onVer={setViendo}
                  onBorrar={(x) => {
                    if (!window.confirm(`¿Eliminar el flyer «${x.titulo}»?`)) return;
                    pedir(`/api/flyers/${x.id}`, { method: 'DELETE' }, 'Flyer eliminado.');
                  }}
                />
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

        {admin && <Popups />}

        <p className="pie">
          Los flyers y los mensajes los publica el encargado. Todo el taller puede verlos y
          copiar los textos para pegarlos en los anuncios del juego.
        </p>
      </main>

      {viendo && (
        <Dialogo titulo={viendo.titulo} onCerrar={() => setViendo(null)}>
          <img className="captura-grande" src={fuenteDeFlyer(viendo)} alt={viendo.titulo} />
          <p className="forma-pie">
            Publicado por {viendo.creadoPor}.{' '}
            <a className="enlace" href={fuenteDeFlyer(viendo)} target="_blank" rel="noreferrer">
              Abrir la imagen
            </a>
          </p>
        </Dialogo>
      )}
    </>
  );
}
