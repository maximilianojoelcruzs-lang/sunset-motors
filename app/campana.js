'use client';

import { useEffect, useRef, useState } from 'react';

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

  useEffect(() => {
    cargar();
    // Se relee cada dos minutos para que una respuesta del encargado aparezca sin recargar.
    const t = setInterval(cargar, 120000);
    return () => clearInterval(t);
  }, []);

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
          <div className="campana-cabeza">Avisos</div>
          {avisos.length === 0 ? (
            <p className="campana-vacio">No tienes avisos.</p>
          ) : (
            <ul className="campana-lista">
              {avisos.map((a) => (
                <li key={a.id} className={a.leido ? '' : 'nuevo'}>
                  {a.enlace ? (
                    <a href={a.enlace}>{a.texto}</a>
                  ) : (
                    <span>{a.texto}</span>
                  )}
                  <span className="campana-cuando">{cuando(a.creado)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
