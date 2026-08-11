'use client';

import { useEffect, useRef, useState } from 'react';
import { duracionMs, enHoras, soloHora } from '../lib/tiempo';
import { marcarTurno } from './marcar';
import { restanMinutos } from './marcaje';
import Campana from './campana';
import Dialogo from './dialogo';
import CambiarClave from './perfil-clave';
import MisTurnos from './perfil-turnos';

/** Iniciales para el círculo del perfil: "mjcruz12" -> "MJ". */
const iniciales = (usuario) =>
  (usuario || '?')
    .replace(/[^a-z0-9]/gi, '')
    .slice(0, 2)
    .toUpperCase();

/**
 * Barra superior con la marca, la navegación y el menú de perfil.
 *
 * El turno llega por props y se avisa hacia arriba al cambiarlo, en vez de guardarlo acá:
 * la calculadora muestra el mismo dato en su propia barra de marcaje, y si cada uno tuviera
 * su copia se contradirían apenas alguien marcara desde el menú.
 */
/**
 * @param variante  'taller' (por defecto) o 'casino'. Cambia la marca, los enlaces y oculta
 *                  el marcaje de turno: quien entra al casino no ficha horas de taller.
 */
export default function Barra({
  usuario,
  admin,
  seccion,
  turno,
  onTurnoCambio,
  variante = 'taller',
}) {
  const esCasino = variante === 'casino';
  const [abierto, setAbierto] = useState(false);
  const [saliendo, setSaliendo] = useState(false);
  const [marcando, setMarcando] = useState(false);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [ventana, setVentana] = useState(null); // 'clave' | 'turnos'
  const [ahora, setAhora] = useState(() => Date.now());

  const caja = useRef(null);
  const boton = useRef(null);

  // Cerrar al hacer clic fuera o con Escape. Sin esto el menú queda pegado.
  useEffect(() => {
    if (!abierto) return;

    const fuera = (e) => {
      if (caja.current && !caja.current.contains(e.target)) setAbierto(false);
    };
    const tecla = (e) => {
      if (e.key !== 'Escape') return;
      setAbierto(false);
      boton.current?.focus();
    };

    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('mousedown', fuera);
      document.removeEventListener('keydown', tecla);
    };
  }, [abierto]);

  // El contador del turno abierto solo corre mientras el menú está a la vista.
  useEffect(() => {
    if (!abierto || !turno) return;
    const t = setInterval(() => setAhora(Date.now()), 30000);
    return () => clearInterval(t);
  }, [abierto, turno]);

  const salir = async () => {
    setSaliendo(true);
    await fetch('/api/logout', { method: 'POST' }).catch(() => {});
    window.location.href = '/login';
  };

  const marcar = async () => {
    setMarcando(true);
    setError('');
    setAviso('');
    const { turno: nuevo, error: fallo } = await marcarTurno(turno ? 'salida' : 'entrada');
    if (fallo) setError(fallo);
    else {
      onTurnoCambio?.(nuevo);
      setAhora(Date.now());
      setAviso(nuevo ? 'Entrada marcada.' : 'Salida marcada.');
    }
    setMarcando(false);
  };

  const abrirVentana = (cual) => {
    setAbierto(false);
    setVentana(cual);
  };

  return (
    <>
      <header className={`barra ${esCasino ? 'barra-casino' : ''}`}>
        <div className="franja" />

        <div className="barra-cuerpo">
          <a className="barra-marca" href={esCasino ? '/casino' : '/'}>
            {esCasino ? (
              <>
                SUNSET <em>ROYALE</em>
              </>
            ) : (
              <>
                SUNSET <em>MOTORS</em>
              </>
            )}
          </a>

          <nav className="barra-nav" aria-label="Secciones">
            {!esCasino && (
              <>
                <a
                  className={`barra-enlace ${seccion === 'calculadora' ? 'activo' : ''}`}
                  href="/"
                  aria-current={seccion === 'calculadora' ? 'page' : undefined}
                >
                  Calculadora
                </a>
                <a
                  className={`barra-enlace ${seccion === 'licencias' ? 'activo' : ''}`}
                  href="/licencias"
                  aria-current={seccion === 'licencias' ? 'page' : undefined}
                >
                  Licencias
                </a>
                <a
                  className={`barra-enlace ${seccion === 'devoluciones' ? 'activo' : ''}`}
                  href="/devoluciones"
                  aria-current={seccion === 'devoluciones' ? 'page' : undefined}
                >
                  Devoluciones
                </a>
                <a
                  className={`barra-enlace ${seccion === 'anuncios' ? 'activo' : ''}`}
                  href="/anuncios"
                  aria-current={seccion === 'anuncios' ? 'page' : undefined}
                >
                  Anuncios
                </a>
                <a
                  className={`barra-enlace ${seccion === 'documentos' ? 'activo' : ''}`}
                  href="/documentos"
                  aria-current={seccion === 'documentos' ? 'page' : undefined}
                >
                  Documentos
                </a>
                {admin && (
                  <>
                    <a
                      className={`barra-enlace ${seccion === 'precios' ? 'activo' : ''}`}
                      href="/precios"
                      aria-current={seccion === 'precios' ? 'page' : undefined}
                    >
                      Precios
                    </a>
                    <a
                      className={`barra-enlace ${seccion === 'registro' ? 'activo' : ''}`}
                      href="/admin"
                      aria-current={seccion === 'registro' ? 'page' : undefined}
                    >
                      Registro
                    </a>
                  </>
                )}
              </>
            )}

            {(esCasino || admin) && (
              <a
                className={`barra-enlace ${seccion === 'casino' ? 'activo' : ''}`}
                href="/casino"
                aria-current={seccion === 'casino' ? 'page' : undefined}
              >
                Casino
              </a>
            )}
          </nav>

          <Campana />

          <div className="perfil" ref={caja}>
            <button
              type="button"
              ref={boton}
              className={`perfil-boton ${turno ? 'en-turno' : ''}`}
              onClick={() => setAbierto((v) => !v)}
              aria-expanded={abierto}
              aria-haspopup="menu"
            >
              <span className="perfil-circulo" aria-hidden="true">
                {iniciales(usuario)}
              </span>
              <span className="perfil-usuario">{usuario}</span>
              <span
                className={`flecha-perfil ${abierto ? 'abierta' : ''}`}
                aria-hidden="true"
              />
            </button>

            {abierto && (
              <div className="perfil-menu" role="menu">
                <div className="perfil-cabecera">
                  <span className="perfil-circulo grande" aria-hidden="true">
                    {iniciales(usuario)}
                  </span>
                  <span className="perfil-datos">
                    <strong>{usuario}</strong>
                    <span>
                      {admin ? 'Administrador' : esCasino ? 'Invitado del casino' : 'Mecánico'}
                    </span>
                  </span>
                </div>

                {!esCasino && (
                  <div className="perfil-turno">
                    <span className="perfil-turno-estado">
                      {turno ? (
                        <>
                          <span className="marcaje-punto" aria-hidden="true" />
                          Desde las {soloHora(turno.entrada)} ·{' '}
                          <strong>{enHoras(duracionMs(turno, ahora))}</strong>
                          <span className="marcaje-resta">
                            se cierra solo en {restanMinutos(turno, ahora)} min
                          </span>
                        </>
                      ) : (
                        'Sin turno abierto'
                      )}
                    </span>
                    <button
                      type="button"
                      role="menuitem"
                      className="accion"
                      onClick={marcar}
                      disabled={marcando}
                    >
                      {marcando ? '…' : turno ? 'Marcar salida' : 'Marcar entrada'}
                    </button>
                  </div>
                )}

                {error && <p className="perfil-error">{error}</p>}
                {aviso && <p className="perfil-aviso">{aviso}</p>}

                {!esCasino && (
                  <button
                    type="button"
                    role="menuitem"
                    className="perfil-opcion"
                    onClick={() => abrirVentana('turnos')}
                  >
                    Mis turnos
                  </button>
                )}
                <button
                  type="button"
                  role="menuitem"
                  className="perfil-opcion"
                  onClick={() => abrirVentana('clave')}
                >
                  Cambiar mi clave
                </button>

                <button
                  type="button"
                  role="menuitem"
                  className="perfil-opcion peligro"
                  onClick={salir}
                  disabled={saliendo}
                >
                  {saliendo ? 'Cerrando…' : 'Cerrar sesión'}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {ventana === 'turnos' && (
        <Dialogo titulo="Mis turnos" onCerrar={() => setVentana(null)}>
          <MisTurnos />
        </Dialogo>
      )}

      {ventana === 'clave' && (
        <Dialogo titulo="Cambiar mi clave" onCerrar={() => setVentana(null)}>
          <CambiarClave
            onListo={(mensaje) => {
              setVentana(null);
              setAviso(mensaje);
              setAbierto(true);
            }}
          />
        </Dialogo>
      )}
    </>
  );
}
