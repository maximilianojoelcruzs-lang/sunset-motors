'use client';

import { useCallback, useState } from 'react';
import useSondeo from '../sondeo';
import { soloFecha, soloHora } from '../../lib/tiempo';

/**
 * Notificaciones internas: los pop-ups que están saliendo ahora, para volver a leerlos.
 *
 * El cartel del login se cierra con un clic y a veces se cierra sin leer. Acá queda lo mismo,
 * en frío, mientras siga vigente.
 *
 * **Sale de la misma lista que el cartel** (`GET /api/popups`, que devuelve solo lo vigente),
 * así que en cuanto se acaba el tiempo límite desaparece de acá también, sin que nadie borre
 * nada. Si esta pantalla filtrara por su cuenta, habría dos sitios donde equivocarse.
 */

/** Cuánto queda, en palabras. Es lo que se mira: la fecha exacta importa menos. */
function loQueQueda(hasta, ahora) {
  if (!hasta) return 'sin fecha de término';
  const minutos = Math.round((Date.parse(hasta) - ahora) / 60000);
  if (minutos <= 0) return 'se acaba de terminar';
  if (minutos < 60) return `quedan ${minutos} min`;
  const horas = Math.round(minutos / 60);
  if (horas < 24) return `quedan ${horas} h`;
  const dias = Math.round(horas / 24);
  return `quedan ${dias} ${dias === 1 ? 'día' : 'días'}`;
}

export default function Notificaciones({ iniciales = [] }) {
  const [popups, setPopups] = useState(iniciales);
  const [ahora, setAhora] = useState(() => Date.now());

  const recargar = useCallback(async () => {
    const r = await fetch('/api/popups', { cache: 'no-store' });
    if (!r.ok) return;
    const { popups: lista } = await r.json().catch(() => ({}));
    if (Array.isArray(lista)) setPopups(lista);
    setAhora(Date.now());
  }, []);

  // Cada minuto: es lo que hace que una que vence mientras miras la pantalla se vaya sola.
  useSondeo(recargar, 60000);

  return (
    <section className="bloque">
      <div className="bloque-cabeza">
        <h2 className="ref-titulo">Notificaciones internas</h2>
        {popups.length > 0 && <span className="mecanicos-cuenta">{popups.length}</span>}
      </div>

      {popups.length === 0 ? (
        <p className="vacio">No hay ninguna notificación activa ahora mismo.</p>
      ) : (
        <ul className="noti-lista">
          {popups.map((p) => (
            <li className="noti" key={p.id}>
              {p.imagen && (
                <img
                  className="noti-imagen"
                  src={p.imagen}
                  alt=""
                  loading="lazy"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              )}
              <div className="noti-texto">
                <strong className="noti-titulo">{p.titulo}</strong>
                <p className="noti-cuerpo">{p.texto}</p>
                <span className="noti-plazo">
                  {loQueQueda(p.hasta, ahora)}
                  {p.hasta && ` · hasta el ${soloFecha(p.hasta)} a las ${soloHora(p.hasta)}`}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="pie">
        Es lo mismo que sale al entrar. Cada una se va de acá sola cuando se le acaba el tiempo
        que le puso el encargado.
      </p>
    </section>
  );
}
