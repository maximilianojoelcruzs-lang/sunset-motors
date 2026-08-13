'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const RECUERDO = 'sunset:tunning-voz';

/**
 * Canta la siguiente pieza en voz alta.
 *
 * Es la parte que de verdad resuelve el problema: mientras se instala, las manos están en el
 * juego y los ojos en el auto. Que la pieza se **oiga** al marcar la anterior evita el
 * alt-tab, que era todo el asunto.
 *
 * Usa el sintetizador que ya trae el navegador — ni dependencia, ni servicio, ni permiso.
 *
 * Dos cosas que parecen detalles y no lo son:
 *
 * - **Las voces cargan tarde.** `getVoices()` viene vacío en el primer render de casi todos
 *   los navegadores y se llena después, por eso hay que escuchar `voiceschanged` o la
 *   primera pieza se canta con acento inglés.
 * - **Se corta lo anterior antes de hablar.** Marcando rápido varias piezas, sin `cancel()`
 *   se encolan y terminas oyendo la número tres cuando vas por la seis.
 */
export default function useVoz() {
  const [encendida, setEncendida] = useState(false);
  const [disponible, setDisponible] = useState(false);
  const voz = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return undefined;
    setDisponible(true);
    setEncendida(localStorage.getItem(RECUERDO) !== 'no');

    const elegir = () => {
      const voces = window.speechSynthesis.getVoices();
      voz.current =
        voces.find((v) => v.lang.toLowerCase().startsWith('es-cl')) ??
        voces.find((v) => v.lang.toLowerCase().startsWith('es')) ??
        voces[0] ??
        null;
    };

    elegir();
    window.speechSynthesis.addEventListener('voiceschanged', elegir);
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', elegir);
      window.speechSynthesis.cancel();
    };
  }, []);

  const alternar = useCallback(() => {
    setEncendida((v) => {
      localStorage.setItem(RECUERDO, v ? 'no' : 'si');
      if (v) window.speechSynthesis?.cancel();
      return !v;
    });
  }, []);

  const decir = useCallback(
    (texto) => {
      if (!encendida || !texto || typeof window === 'undefined') return;
      const sintetizador = window.speechSynthesis;
      if (!sintetizador) return;

      sintetizador.cancel();
      const frase = new SpeechSynthesisUtterance(texto);
      if (voz.current) frase.voice = voz.current;
      frase.lang = voz.current?.lang ?? 'es-CL';
      frase.rate = 1.05;
      sintetizador.speak(frase);
    },
    [encendida]
  );

  return { encendida, disponible, alternar, decir };
}

/**
 * Cómo se canta una pieza. Corto y en el orden en que se hace: primero dónde entrar en el
 * menú, después qué elegir. «Techo, número cuatro».
 */
export const comoSeDice = (nombre, valor, esTexto) =>
  esTexto ? `${nombre}, ${valor}` : `${nombre}, número ${valor}`;
