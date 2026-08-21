'use client';

import { useEffect, useRef, useState } from 'react';
import useSondeo from './sondeo';

const cuando = (iso) => {
  const minutos = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (minutos < 1) return 'recién';
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.round(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;
  const dias = Math.round(horas / 24);
  return `hace ${dias} día${dias === 1 ? '' : 's'}`;
};

/** Avisos dentro de la app. No hay correo: esto aparece cuando la persona entra. */
export default function Campana() {
  const [avisos, setAvisos] = useState([]);
  const [sinLeer, setSinLeer] = useState(0);
  const [abierta, setAbierta] = useState(false);
  const [error, setError] = useState('');
  const caja = useRef(null);
  const boton = useRef(null);

  const cargar = async () => {
    try {
      const r = await fetch('/api/avisos', { cache: 'no-store' });
      if (!r.ok) return;
      const cuerpo = await r.json();
      setAvisos(cuerpo.avisos ?? []);
      setSinLeer(cuerpo.sinLeer ?? 0);
    } catch {
      // Un fallo de red acá no debe romper nada: la campanita simplemente no se actualiza.
    }
  };

  // Cada 20 segundos, y de inmediato al volver a la pestaña: un aviso que tarda dos minutos
  // en aparecer obliga igual a recargar a mano, que es lo que se quería evitar.
  useEffect(() => {
    cargar();
  }, []);
  useSondeo(cargar, 20000);

  useEffect(() => {
    if (!abierta) return;
    const fuera = (e) => {
      if (caja.current && !caja.current.contains(e.target)) setAbierta(false);
    };
    const tecla = (e) => {
      if (e.key !== 'Escape') return;
      setAbierta(false);
      boton.current?.focus();
    };
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('mousedown', fuera);
      document.removeEventListener('keydown', tecla);
    };
  }, [abierta]);

  /**
   * Borrar uno, o todos si no viene identificador.
   *
   * La fila se saca de la pantalla **antes** de que el servidor conteste: con la lista llena,
   * esperar la respuesta para que desaparezca una línea se siente pegado. Si la escritura
   * falla se vuelve a leer y la lista queda como esté de verdad, con el aviso a la vista.
   */
  const borrar = async (id) => {
    const previos = avisos;
    setAvisos(id ? avisos.filter((a) => a.id !== id) : []);
    setError('');

    try {
      const r = await fetch(`/api/avisos${id ? `?id=${encodeURIComponent(id)}` : ''}`, {
        method: 'DELETE',
      });
      if (!r.ok) {
        setAvisos(previos);
        const cuerpo = await r.json().catch(() => ({}));
        setError(cuerpo.error || 'No se pudo borrar.');
        return;
      }
      // El contador puede quedar desfasado si se borró algo sin leer.
      await cargar();
    } catch {
      setAvisos(previos);
      setError('Sin conexión con el servidor.');
    }
  };

  const alternar = async () => {
    const abriendo = !abierta;
    setAbierta(abriendo);
    if (abriendo) {
      await cargar();
      if (sinLeer > 0) {
        // Marcar leídos en cuanto se abren: el contador es "hay algo nuevo", no una
        // bandeja de entrada que haya que ir despachando una por una.
        await fetch('/api/avisos', { method: 'POST' }).catch(() => {});
        setSinLeer(0);
      }
    }
  };

  return (
    <div className="campana" ref={caja}>
      <button
        type="button"
        ref={boton}
        className="campana-boton"
        onClick={alternar}
        aria-expanded={abierta}
        aria-haspopup="menu"
        aria-label={sinLeer > 0 ? `Avisos, ${sinLeer} sin leer` : 'Avisos'}
      >
        <svg viewBox="0 0 20 20" aria-hidden="true" className="campana-icono">
          <path
            d="M10 2a5 5 0 0 0-5 5v3.6L3.6 13.2A.8.8 0 0 0 4.3 14.4h11.4a.8.8 0 0 0 .7-1.2L15 10.6V7a5 5 0 0 0-5-5Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          <path d="M8 16.4a2 2 0 0 0 4 0" fill="none" stroke="currentColor" strokeWidth="1.4" />
        </svg>
        {sinLeer > 0 && <span className="campana-punto">{sinLeer > 9 ? '9+' : sinLeer}</span>}
      </button>

      {abierta && (
        <div className="campana-menu" role="menu">
          <div className="campana-cabeza">
            <span>
              Avisos
              {avisos.length > 0 && <em className="campana-cuenta">{avisos.length}</em>}
            </span>
            {/* Solo aparece con algo que borrar: un botón que no hace nada estorba. */}
            {avisos.length > 0 && (
              <button type="button" className="campana-limpiar" onClick={() => borrar()}>
                Borrar todos
              </button>
            )}
          </div>

          {error && <p className="campana-error">{error}</p>}

          {avisos.length === 0 ? (
            <p className="campana-vacio">No tienes avisos.</p>
          ) : (
            <ul className="campana-lista">
              {avisos.map((a) => (
                <li key={a.id} className={a.leido ? '' : 'nuevo'}>
                  <div className="campana-texto">
                    {a.enlace ? <a href={a.enlace}>{a.texto}</a> : <span>{a.texto}</span>}
                    <span className="campana-cuando">{cuando(a.creado)}</span>
                  </div>
                  <button
                    type="button"
                    className="campana-quitar"
                    onClick={() => borrar(a.id)}
                    aria-label="Borrar este aviso"
                    title="Borrar"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
