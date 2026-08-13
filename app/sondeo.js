'use client';

import { useEffect, useRef } from 'react';

/**
 * Vuelve a pedir algo cada tanto, para que la pantalla se entere sola de lo que pasa en el
 * servidor sin que nadie apriete F5.
 *
 * Tres cosas que no son adorno:
 *
 * - **Se detiene con la pestaña escondida.** Sin esto, veinte pestañas olvidadas siguen
 *   consultando toda la noche, y contra Supabase eso son lecturas de verdad.
 * - **Consulta al volver.** Es el momento en que a alguien le importa estar al día: acaba de
 *   mirar la pantalla. Esperar al siguiente turno del reloj se siente roto.
 * - **No se solapa.** Si una consulta tarda más que el intervalo, se salta el turno en vez de
 *   encadenar peticiones que llegan desordenadas.
 *
 * No es tiempo real ni pretende serlo: para un taller de rol, enterarse en menos de medio
 * minuto es de sobra, y no necesita websockets ni un servicio aparte.
 */
export default function useSondeo(consultar, cada = 20000) {
  const guardada = useRef(consultar);
  const enVuelo = useRef(false);

  // Se guarda la última versión para que el intervalo no se reinicie en cada pintado.
  useEffect(() => {
    guardada.current = consultar;
  }, [consultar]);

  useEffect(() => {
    if (!cada) return undefined;

    const tocar = async () => {
      if (enVuelo.current || document.hidden) return;
      enVuelo.current = true;
      try {
        await guardada.current();
      } catch {
        /* una consulta perdida no rompe nada: la siguiente lo arregla */
      } finally {
        enVuelo.current = false;
      }
    };

    const reloj = setInterval(tocar, cada);
    const alVolver = () => {
      if (!document.hidden) tocar();
    };
    document.addEventListener('visibilitychange', alVolver);
    window.addEventListener('focus', alVolver);

    return () => {
      clearInterval(reloj);
      document.removeEventListener('visibilitychange', alVolver);
      window.removeEventListener('focus', alVolver);
    };
  }, [cada]);
}
