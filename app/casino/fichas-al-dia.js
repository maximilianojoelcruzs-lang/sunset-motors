'use client';

import { useCallback, useRef } from 'react';
import useSondeo from '../sondeo';

/**
 * Mantiene al día las fichas que se ven en pantalla.
 *
 * El número que muestra cada mesa sale de su propia jugada, y eso está bien: es el resultado
 * que acaba de devolver el servidor. Lo que no se enteraba era de lo que pasa **fuera** de la
 * mesa: una recarga del encargado, el pago del podio del top, o la misma cuenta jugando en otra
 * pestaña. Había que recargar la página para ver las fichas de verdad.
 *
 * **La mesa sigue mandando.** Si el saldo cambió mientras la consulta viajaba, esa consulta se
 * descarta: su respuesta es anterior a la jugada y aplicarla haría saltar la cifra hacia atrás.
 * Solo cuando nada se movió se aplica lo que dice el servidor.
 *
 * El sondeo se detiene con la pestaña escondida y consulta al volver a ella (ver `useSondeo`),
 * que es justo cuando a alguien le importa: acaba de mirar la pantalla.
 */
export default function useFichasAlDia(saldo, onSaldo, cada = 20000) {
  const actual = useRef(saldo);
  actual.current = saldo;

  const consultar = useCallback(async () => {
    const antes = actual.current;

    const r = await fetch('/api/casino/saldo', { cache: 'no-store' });
    if (!r.ok) return;

    const { saldo: enElServidor } = await r.json().catch(() => ({}));
    if (typeof enElServidor !== 'number') return;

    // La mesa se movió con la consulta en el aire: manda ella.
    if (actual.current !== antes) return;
    if (enElServidor !== actual.current) onSaldo(enElServidor);
  }, [onSaldo]);

  // Sin quien reciba el saldo no hay nada que actualizar, y una consulta cada 20 segundos para
  // nada son lecturas de verdad contra la base.
  useSondeo(consultar, onSaldo ? cada : 0);
}
