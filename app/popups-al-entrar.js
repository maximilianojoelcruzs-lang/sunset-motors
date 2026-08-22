'use client';

import { useEffect, useState } from 'react';

/**
 * Los pop-ups que salen al entrar a la app.
 *
 * Va dentro de `Barra`, que está en todas las pantallas del taller y del casino: así el cartel
 * sale estés donde estés, sin repetir la misma línea en catorce páginas.
 *
 * **Se muestra una vez por sesión del navegador, no en cada clic.** Cada entrada nueva —el
 * login, o abrir la app en otra pestaña— lo enseña otra vez; recargar la misma pestaña, no. La
 * marca va en `sessionStorage` y no en `localStorage` a propósito: con `localStorage` el cartel
 * saldría una sola vez en la vida de ese navegador, y quien lo cerrara sin leerlo no volvería
 * a verlo nunca.
 *
 * Cuándo deja de salir lo decide el servidor con el tiempo límite de cada cartel; acá no se
 * filtra nada por fecha, para que no haya dos sitios donde equivocarse.
 */
const CLAVE = 'sunset_popups_vistos';

const yaVistos = () => {
  try {
    return new Set(JSON.parse(sessionStorage.getItem(CLAVE) ?? '[]'));
  } catch {
    return new Set();
  }
};

const anotarVisto = (id) => {
  try {
    const vistos = yaVistos();
    vistos.add(id);
    sessionStorage.setItem(CLAVE, JSON.stringify([...vistos]));
  } catch {
    /* sin sessionStorage (pestaña privada, permisos) el cartel sale otra vez: no es grave */
  }
};

export default function PopupsAlEntrar() {
  const [cola, setCola] = useState([]);

  useEffect(() => {
    let vivo = true;

    (async () => {
      try {
        const r = await fetch('/api/popups', { cache: 'no-store' });
        if (!r.ok) return;
        const { popups } = await r.json();
        if (!vivo || !Array.isArray(popups)) return;

        const vistos = yaVistos();
        setCola(popups.filter((p) => !vistos.has(p.id)));
      } catch {
        /* un cartel que no llega no puede romper la página */
      }
    })();

    return () => {
      vivo = false;
    };
  }, []);

  if (!cola.length) return null;

  const actual = cola[0];
  const quedan = cola.length - 1;

  const cerrar = () => {
    anotarVisto(actual.id);
    setCola((antes) => antes.slice(1));
  };

  return (
    <div
      className="velo popup-velo"
      // Se cierra con el botón, no tocando el fondo: es lo único que hay que leer al entrar y
      // un clic despistado no debería saltárselo.
      role="presentation"
    >
      <div className="popup" role="dialog" aria-modal="true" aria-labelledby="popup-titulo">
        {actual.imagen && (
          // La imagen es un enlace pegado por el encargado y la carga el navegador de quien
          // mira, como cualquier otra. Si el enlace se rompe, se esconde en vez de dejar el
          // icono de imagen rota ocupando media ventana.
          <img
            className="popup-imagen"
            src={actual.imagen}
            alt=""
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        )}

        <div className="popup-cuerpo">
          <h2 className="popup-titulo" id="popup-titulo">
            {actual.titulo}
          </h2>
          <p className="popup-texto">{actual.texto}</p>

          <div className="popup-pie">
            {quedan > 0 && (
              <span className="popup-cuenta">
                y {quedan} {quedan === 1 ? 'aviso más' : 'avisos más'}
              </span>
            )}
            <button type="button" className="accion destacada" onClick={cerrar} autoFocus>
              {quedan > 0 ? 'Siguiente' : 'Entendido'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
