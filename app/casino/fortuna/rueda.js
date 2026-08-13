'use client';

import { CASILLAS, GAJOS } from '../../../lib/fortuna';

const PASO = 360 / CASILLAS;

/**
 * Redondeo a 3 decimales antes de escribir cada coordenada.
 *
 * `Math.cos` puede dar el último bit distinto en Node y en el navegador, y entonces el HTML
 * del servidor no coincide carácter por carácter con el del cliente: React lo detecta como
 * desajuste de hidratación y descarta el árbol. Pasó de verdad con la ruleta europea.
 */
const r3 = (n) => Math.round(n * 1000) / 1000;

/** La rueda de la suerte. No decide nada: recibe el ángulo y gira hasta ahí. */
export default function Rueda({ angulo, girando }) {
  const radio = 132;
  const centro = 150;

  return (
    <div className="fortuna-caja">
      <span className="fortuna-aguja" aria-hidden="true" />
      <svg
        className={`fortuna-rueda ${girando ? 'girando' : ''}`}
        viewBox="0 0 300 300"
        style={{ transform: `rotate(${angulo}deg)` }}
        aria-hidden="true"
      >
        <circle cx={centro} cy={centro} r={radio + 10} className="fortuna-borde" />

        {GAJOS.map((gajo, i) => {
          const desde = (i * PASO - 90 - PASO / 2) * (Math.PI / 180);
          const hasta = ((i + 1) * PASO - 90 - PASO / 2) * (Math.PI / 180);
          const x1 = r3(centro + radio * Math.cos(desde));
          const y1 = r3(centro + radio * Math.sin(desde));
          const x2 = r3(centro + radio * Math.cos(hasta));
          const y2 = r3(centro + radio * Math.sin(hasta));
          const medio = (i * PASO - 90) * (Math.PI / 180);
          const tx = r3(centro + (radio - 26) * Math.cos(medio));
          const ty = r3(centro + (radio - 26) * Math.sin(medio));

          return (
            <g key={i}>
              <path
                d={`M${centro},${centro} L${x1},${y1} A${radio},${radio} 0 0,1 ${x2},${y2} Z`}
                fill={gajo.color}
                stroke="rgba(0,0,0,0.45)"
                strokeWidth="0.6"
              />
              {gajo.multiplicador > 0 && (
                <text
                  x={tx}
                  y={ty}
                  className="fortuna-numero"
                  transform={`rotate(${r3(i * PASO + 90)}, ${tx}, ${ty})`}
                >
                  x{gajo.multiplicador}
                </text>
              )}
            </g>
          );
        })}

        <circle cx={centro} cy={centro} r="30" className="fortuna-centro" />
        <circle cx={centro} cy={centro} r="9" className="fortuna-eje" />
      </svg>
    </div>
  );
}

/**
 * Ángulo al que hay que dejar la rueda para que `gajo` quede bajo la aguja, con vueltas de
 * más para que el giro se vea largo.
 */
export function anguloDe(gajo, vueltas = 5) {
  return vueltas * 360 - gajo * PASO;
}
