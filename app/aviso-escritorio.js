'use client';

import { useEffect, useRef, useState } from 'react';
import { HORAS_MAXIMAS } from '../lib/turnos-limites';

// Avisos del sistema —los de Windows, los de verdad, fuera del navegador— para que el turno no
// se cierre solo mientras alguien está jugando y no mirando la pestaña.
//
// **Lo que esto no es**: no hay notificaciones push. Para eso hacen falta un service worker, una
// suscripción y un servicio de envío, y esta app no tiene proceso de fondo. Así que el aviso
// salta mientras la pestaña siga abierta, aunque esté detrás del juego o minimizada. Con el
// navegador cerrado del todo, no. Es la diferencia entre un recordatorio y una alarma, y hay que
// decirlo en la pantalla en vez de que alguien lo descubra perdiendo un turno.

/** A cuántos minutos del cierre avisar. De más lejos a más cerca. */
export const AVISOS = [15, 5];

const hayApi = () => typeof window !== 'undefined' && 'Notification' in window;

/** 'no-soportado' | 'default' | 'granted' | 'denied' */
export const permisoActual = () => (hayApi() ? Notification.permission : 'no-soportado');

export async function pedirPermiso() {
  if (!hayApi()) return 'no-soportado';
  if (Notification.permission !== 'default') return Notification.permission;
  return Notification.requestPermission();
}

/** Lo ya avisado, para no repetir al recargar la página ni al volver a pintar. */
const YA = 'sunset_avisos_turno';

const leerYa = () => {
  try {
    return new Set(JSON.parse(localStorage.getItem(YA) ?? '[]'));
  } catch {
    return new Set();
  }
};

const anotarYa = (marca) => {
  const ya = leerYa();
  ya.add(marca);
  // Solo interesan las del turno de ahora; sin recortar, esto crece para siempre.
  try {
    localStorage.setItem(YA, JSON.stringify([...ya].slice(-20)));
  } catch {
    /* modo incógnito o almacenamiento lleno: se avisará de más, no de menos */
  }
};

function avisar(titulo, texto) {
  try {
    const aviso = new Notification(titulo, { body: texto, icon: '/favicon.ico', tag: 'turno' });
    // Al pulsar el aviso se trae la ventana al frente, que es lo que uno quiere hacer después.
    aviso.onclick = () => {
      window.focus();
      aviso.close();
    };
  } catch {
    /* algunos navegadores exigen service worker; sin él no se avisa, pero nada se rompe */
  }
}

/**
 * Avisa cuando al turno abierto le quedan pocos minutos.
 *
 * Comprueba cada 20 s en vez de programar un temporizador exacto: si el equipo se suspende o la
 * pestaña se congela, un `setTimeout` a una hora vista no dispara cuando debía. Mirando el reloj
 * cada poco, al volver de la suspensión el aviso sale enseguida.
 */
export function useAvisoTurno(turno) {
  const ultimo = useRef(null);

  useEffect(() => {
    if (!turno || permisoActual() !== 'granted') return undefined;

    // Cambió el turno: lo avisado del anterior ya no vale.
    if (ultimo.current !== turno.id) ultimo.current = turno.id;

    const mirar = () => {
      const restan = Math.ceil(
        (Date.parse(turno.entrada) + HORAS_MAXIMAS * 3600000 - Date.now()) / 60000
      );

      for (const umbral of AVISOS) {
        const marca = `${turno.id}:${umbral}`;
        if (restan > umbral || restan <= 0 || leerYa().has(marca)) continue;
        anotarYa(marca);
        avisar(
          'Sunset Motors — tu turno está por cerrarse',
          `Quedan ${restan} min. Si sigues en el taller, vuelve a marcar entrada cuando se cierre.`
        );
        break;
      }

      const cierre = `${turno.id}:cerrado`;
      if (restan <= 0 && !leerYa().has(cierre)) {
        anotarYa(cierre);
        avisar(
          'Sunset Motors — turno cerrado',
          `Se cumplieron las ${HORAS_MAXIMAS} horas. Marca entrada de nuevo si sigues trabajando.`
        );
      }
    };

    mirar();
    const reloj = setInterval(mirar, 20000);
    return () => clearInterval(reloj);
  }, [turno]);
}

/**
 * El botón para activarlos. Se enseña **solo cuando hace falta**: si ya están concedidos no
 * pinta nada, y si el navegador no los soporta tampoco.
 *
 * No se pide el permiso al cargar la página: un navegador que pregunta sin que nadie lo haya
 * pedido es lo que hace que la gente pulse «bloquear» por reflejo, y entonces ya no hay vuelta.
 */
export function BotonAvisos() {
  const [estado, setEstado] = useState('cargando');

  useEffect(() => setEstado(permisoActual()), []);

  if (estado === 'cargando' || estado === 'no-soportado' || estado === 'granted') return null;

  if (estado === 'denied') {
    return (
      <p className="aviso-permiso">
        Los avisos del sistema están bloqueados para esta página. Se activan desde el candado de
        la barra de direcciones → <em>Notificaciones</em>.
      </p>
    );
  }

  return (
    <button
      type="button"
      className="accion"
      onClick={async () => setEstado(await pedirPermiso())}
      title={`Avisa en el escritorio cuando falten ${AVISOS[0]} y ${AVISOS[1]} minutos`}
    >
      🔔 Avisarme antes de que se cierre
    </button>
  );
}
