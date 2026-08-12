'use client';

import { RUEDA, color } from '../../../lib/ruleta';

const PASO = 360 / RUEDA.length;

/**
 * Redondea a 3 decimales antes de escribir la coordenada en el SVG.
 *
 * No es cosmética: `Math.cos` puede dar el último bit distinto en Node y en el navegador,
 * y entonces el HTML del servidor y el del cliente no coinciden carácter por carácter.
 * React lo detecta como desajuste de hidratación y descarta el árbol. Con 3 decimales el
 * texto es idéntico en ambos lados y sobra precisión para dibujar.
 */
const r3 = (n) => Math.round(n * 1000) / 1000;

/**
 * La rueda, dibujada en SVG.
 *
 * No decide nada: recibe el ángulo al que tiene que quedar y gira hasta ahí. El número ya
 * lo sorteó el servidor — esto es la parte bonita, no la parte que reparte.
 */
export default function Rueda({ angulo, girando }) {
  const radio = 130;
  const centro = 150;

  return (
    <div className="rueda-caja">
      <span className="rueda-aguja" aria-hidden="true" />
      <svg
        className={`rueda ${girando ? 'girando' : ''}`}
        viewBox="0 0 300 300"
        style={{ transform: `rotate(${angulo}deg)` }}
        aria-hidden="true"
      >
        <circle cx={centro} cy={centro} r={radio + 12} className="rueda-borde" />

        {RUEDA.map((n, i) => {
          const desde = (i * PASO - 90 - PASO / 2) * (Math.PI / 180);
          const hasta = ((i + 1) * PASO - 90 - PASO / 2) * (Math.PI / 180);
          const x1 = r3(centro + radio * Math.cos(desde));
          const y1 = r3(centro + radio * Math.sin(desde));
          const x2 = r3(centro + radio * Math.cos(hasta));
          const y2 = r3(centro + radio * Math.sin(hasta));
          const medio = (i * PASO - 90) * (Math.PI / 180);
          const tx = r3(centro + (radio - 20) * Math.cos(medio));
          const ty = r3(centro + (radio - 20) * Math.sin(medio));

          return (
            <g key={n}>
              <path
                d={`M${centro},${centro} L${x1},${y1} A${radio},${radio} 0 0,1 ${x2},${y2} Z`}
                className={`casilla casilla-${color(n)}`}
              />
              <text
                x={tx}
                y={ty}
                className="casilla-numero"
                transform={`rotate(${r3(i * PASO)}, ${tx}, ${ty})`}
              >
                {n}
              </text>
            </g>
          );
        })}

        <circle cx={centro} cy={centro} r="34" className="rueda-centro" />
        <circle cx={centro} cy={centro} r="10" className="rueda-eje" />
      </svg>
    </div>
  );
}

/**
 * Ángulo al que hay que dejar la rueda para que `numero` quede bajo la aguja.
 * Se le suman vueltas completas para que el giro se vea largo.
 */
export function anguloDe(numero, vueltas = 6) {
  const i = RUEDA.indexOf(numero);
  return vueltas * 360 - i * PASO;
}
