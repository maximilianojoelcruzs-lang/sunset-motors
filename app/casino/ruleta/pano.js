'use client';

import { useRef } from 'react';
import { EXTERIORES, INTERIORES, esRojo, pagaDe } from '../../../lib/ruleta';

const fmt = new Intl.NumberFormat('es-CL');

/** Fichas cortas: 1.500 se lee mal en un círculo de 22 píxeles. */
export function corto(n) {
  if (n >= 1000000) return `${Math.round(n / 100000) / 10}M`;
  if (n >= 1000) return `${Math.round(n / 100) / 10}k`;
  return fmt.format(n);
}

const FUERA = [
  ['docena1', 'docena2', 'docena3'],
  ['falta', 'par', 'rojo', 'negro', 'impar', 'pasa'],
  ['columna1', 'columna2', 'columna3'],
];

/** Una ficha apilada sobre un sitio del paño. */
function Ficha({ monto }) {
  return <span className="ficha-puesta">{corto(monto)}</span>;
}

/**
 * El paño, con todos los sitios donde se puede poner una ficha.
 *
 * Los interiores se dibujan sobre una rejilla en la que las casillas y **los bordes entre
 * casillas** son pistas propias: eso es lo que permite apostar a caballo, a la calle o al
 * cuadro poniendo la ficha donde iría en una mesa de verdad, y no con un menú aparte.
 * Las coordenadas vienen de `lib/ruleta.js` — acá no se calcula ninguna.
 */
export default function Pano({ apuestas, onPoner, onQuitar, bloqueado, ganadores }) {
  const largo = useRef(null);
  const quitado = useRef(false);

  /**
   * Poner con un toque, quitar manteniendo pulsado. Se hace con eventos de puntero y no solo
   * con el menú contextual porque en el teléfono no hay botón derecho, y quitar una ficha
   * mal puesta tiene que ser posible ahí también.
   */
  const manejadores = (id) => ({
    onPointerDown: () => {
      quitado.current = false;
      largo.current = setTimeout(() => {
        quitado.current = true;
        onQuitar(id);
      }, 450);
    },
    onPointerUp: () => clearTimeout(largo.current),
    onPointerLeave: () => clearTimeout(largo.current),
    onPointerCancel: () => clearTimeout(largo.current),
    onClick: () => {
      if (quitado.current) {
        quitado.current = false;
        return;
      }
      onPoner(id);
    },
    onContextMenu: (e) => {
      e.preventDefault();
      onQuitar(id);
    },
  });

  const sitio = (a) => {
    const puesto = apuestas[a.id] ?? 0;
    const gana = ganadores?.has(a.id);
    const numero = a.tipo === 'pleno' ? a.numeros[0] : null;

    return (
      <button
        key={a.id}
        type="button"
        disabled={bloqueado}
        className={[
          numero === null ? 'pano-borde' : 'pano-numero',
          numero === null ? `borde-${a.tipo}` : numero === 0 ? 'cero' : esRojo(numero) ? 'rojo' : 'negro',
          puesto ? 'con-ficha' : '',
          gana ? 'gana' : '',
        ].join(' ')}
        style={{
          gridColumn: a.col,
          gridRow: a.span ? `${a.fila} / span ${a.span}` : a.fila,
        }}
        title={`${a.etiqueta} · paga ${pagaDe(a.numeros.length)}:1`}
        aria-label={`${a.etiqueta}, paga ${pagaDe(a.numeros.length)} a 1${puesto ? `, ${fmt.format(puesto)} fichas puestas` : ''}`}
        {...manejadores(a.id)}
      >
        {numero !== null ? numero : null}
        {puesto ? <Ficha monto={puesto} /> : null}
      </button>
    );
  };

  return (
    <div className="pano">
      <div className="pano-rejilla">{INTERIORES.map(sitio)}</div>

      <div className="pano-fuera">
        {FUERA.map((fila, i) => (
          <div className="pano-fila" key={i}>
            {fila.map((id) => {
              const def = EXTERIORES[id];
              const puesto = apuestas[id] ?? 0;

              return (
                <button
                  key={id}
                  type="button"
                  disabled={bloqueado}
                  className={`pano-opcion ${id} ${puesto ? 'con-ficha' : ''} ${
                    ganadores?.has(id) ? 'gana' : ''
                  }`}
                  {...manejadores(id)}
                >
                  {def.etiqueta}
                  <span className="pano-paga">{pagaDe(def.numeros.length)}:1</span>
                  {puesto ? <Ficha monto={puesto} /> : null}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
