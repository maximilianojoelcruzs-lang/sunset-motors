'use client';

import { useState } from 'react';
import Barra from '../barra';

/**
 * Fachada del casino. Por ahora es solo eso: la vista, sin ningún juego detrás.
 *
 * Las fichas que se muestran son de adorno y están escritas acá a mano — no hay saldo real
 * ni nada que se pueda ganar o perder. Cuando existan los juegos, esto sale de la base.
 */
const FICHAS_DEMO = 12500;

const MESAS = [
  {
    id: 'ruleta',
    nombre: 'Ruleta',
    lema: 'Rojo, negro y la suerte de siempre',
    icono: (
      <>
        <circle cx="24" cy="24" r="17" />
        <circle cx="24" cy="24" r="6" />
        <path d="M24 7v10M24 31v10M7 24h10M31 24h10M12 12l7 7M29 29l7 7M36 12l-7 7M19 29l-7 7" />
      </>
    ),
  },
  {
    id: 'blackjack',
    nombre: 'Blackjack',
    lema: 'Llega a 21 sin pasarte',
    icono: (
      <>
        <rect x="9" y="11" width="20" height="27" rx="3" />
        <rect x="19" y="11" width="20" height="27" rx="3" />
        <path d="M29 21v7M25.5 24.5h7" />
      </>
    ),
  },
  {
    id: 'tragamonedas',
    nombre: 'Tragamonedas',
    lema: 'Tres iguales y se prende todo',
    icono: (
      <>
        <rect x="7" y="12" width="34" height="24" rx="3" />
        <path d="M18 12v24M30 12v24" />
        <path d="M12 24h1M23.5 24h1M35 24h1" />
      </>
    ),
  },
  {
    id: 'dados',
    nombre: 'Dados',
    lema: 'Sopla y tira',
    icono: (
      <>
        <rect x="8" y="8" width="22" height="22" rx="4" />
        <rect x="20" y="20" width="20" height="20" rx="4" />
        <path d="M15 15h.1M23 23h.1M27 33h.1M33 27h.1" />
      </>
    ),
  },
  {
    id: 'poker',
    nombre: 'Póker',
    lema: 'La cara de piedra es gratis',
    icono: (
      <>
        <path d="M24 8l9 11-9 11-9-11z" />
        <circle cx="14" cy="34" r="6" />
        <circle cx="34" cy="34" r="6" />
      </>
    ),
  },
  {
    id: 'rasca',
    nombre: 'Rasca y gana',
    lema: 'Un raspón y a ver qué sale',
    icono: (
      <>
        <rect x="8" y="13" width="32" height="22" rx="3" />
        <path d="M14 26l5-5 5 5 5-6 5 6" />
      </>
    ),
  },
];

function Mesa({ mesa }) {
  return (
    <article className="mesa">
      <div className="mesa-marco">
        <svg className="mesa-icono" viewBox="0 0 48 48" aria-hidden="true">
          <g
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {mesa.icono}
          </g>
        </svg>
        <span className="mesa-brillo" aria-hidden="true" />
      </div>
      <h3 className="mesa-nombre">{mesa.nombre}</h3>
      <p className="mesa-lema">{mesa.lema}</p>
      <span className="mesa-pronto">Próximamente</span>
    </article>
  );
}

export default function Casino({ usuario, admin }) {
  const [turno, setTurno] = useState(null);

  return (
    <div className="casino">
      <Barra
        usuario={usuario}
        admin={admin}
        seccion="casino"
        variante="casino"
        turno={turno}
        onTurnoCambio={setTurno}
      />

      {/* Ambiente: resplandores y la retícula en fuga. Puro adorno, sin contenido. */}
      <div className="casino-fondo" aria-hidden="true">
        <span className="casino-halo halo-1" />
        <span className="casino-halo halo-2" />
        <span className="casino-halo halo-3" />
        <span className="casino-reja" />
      </div>

      <main className="casino-cuerpo">
        <header className="casino-portada">
          <span className="casino-cinta">Sala privada · solo invitados</span>
          <h1 className="casino-nombre">
            SUNSET <span>ROYALE</span>
          </h1>
          <p className="casino-bajada">
            Bienvenido de vuelta, <strong>{usuario}</strong>. Las mesas se están puliendo.
          </p>

          <div className="casino-fichas">
            <span className="fichas-rotulo">Tus fichas</span>
            <span className="fichas-cifra">
              {new Intl.NumberFormat('es-CL').format(FICHAS_DEMO)}
            </span>
            <span className="fichas-nota">de muestra</span>
          </div>
        </header>

        <section className="casino-mesas">
          <div className="casino-titulo-fila">
            <h2 className="casino-titulo">Mesas</h2>
            <span className="casino-linea" aria-hidden="true" />
            <span className="casino-cuenta">{MESAS.length}</span>
          </div>

          <div className="mesas-rejilla">
            {MESAS.map((m) => (
              <Mesa key={m.id} mesa={m} />
            ))}
          </div>
        </section>

        <p className="casino-aviso">
          Esto es una fachada de prueba: no hay ningún juego funcionando todavía, las fichas
          son de adorno y no se gana ni se pierde nada. Es entretención de rol para el
          servidor — no se juega con dinero real ni se puede convertir en dinero real.
        </p>
      </main>
    </div>
  );
}
