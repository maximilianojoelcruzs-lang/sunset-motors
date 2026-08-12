'use client';

import { esRoja, FIGURAS } from '../../lib/poker';

/**
 * La cara de una carta. Va aparte porque el póker la mete dentro de un botón —ahí las cartas
 * se tocan— y el blackjack no, y duplicar el dibujo era garantía de que uno de los dos se
 * quedara atrás al cambiar algo.
 */
export function Cara({ carta }) {
  const cara = FIGURAS[carta.valor] ?? carta.valor;

  return (
    <>
      <span className="carta-esquina">
        {cara}
        <em>{carta.palo}</em>
      </span>
      <span className="carta-palo">{carta.palo}</span>
      <span className="carta-esquina abajo">
        {cara}
        <em>{carta.palo}</em>
      </span>
    </>
  );
}

export const nombreCarta = (carta) => `${FIGURAS[carta.valor] ?? carta.valor} de ${carta.palo}`;

/** Una carta que solo se mira. */
export default function Carta({ carta, tapada, clase = '', sello = '' }) {
  if (tapada || !carta) {
    return (
      <div className="carta dorso" aria-label="Carta tapada">
        <span />
      </div>
    );
  }

  return (
    <div
      className={`carta ${esRoja(carta) ? 'roja' : ''} ${clase}`}
      aria-label={nombreCarta(carta)}
    >
      <Cara carta={carta} />
      {sello ? <span className="carta-sello">{sello}</span> : null}
    </div>
  );
}
