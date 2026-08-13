'use client';

import { useState } from 'react';
import Link from 'next/link';
import Barra from '../barra';
import Retiro from './retiro';

/**
 * La sala. Cada mesa con `ruta` ya funciona; las demás siguen siendo tarjetas.
 * El saldo llega del servidor: acá no se calcula ni se guarda nada.
 */
const MESAS = [
  {
    id: 'ruleta',
    nombre: 'Ruleta',
    lema: 'Rojo, negro y la suerte de siempre',
    ruta: '/casino/ruleta',
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
    ruta: '/casino/blackjack',
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
    ruta: '/casino/tragamonedas',
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
    lema: 'Sic Bo · tres dados',
    ruta: '/casino/dados',
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
    nombre: 'Vídeo póker',
    lema: 'Jacks or Better · el mejor retorno de la sala',
    ruta: '/casino/poker',
    icono: (
      <>
        <path d="M24 8l9 11-9 11-9-11z" />
        <circle cx="14" cy="34" r="6" />
        <circle cx="34" cy="34" r="6" />
      </>
    ),
  },
  {
    id: 'bingo',
    nombre: 'Bingo',
    lema: 'La única mesa donde se juega entre todos',
    ruta: '/casino/bingo',
    icono: (
      <>
        <rect x="8" y="8" width="32" height="32" rx="4" />
        <path d="M8 18h32M8 29h32M19 8v32M30 8v32" />
      </>
    ),
  },
  {
    id: 'mines',
    nombre: 'Mines',
    lema: 'Destapa y cobra antes de la mina',
    ruta: '/casino/mines',
    icono: (
      <>
        <circle cx="24" cy="26" r="11" />
        <path d="M24 15V9M31 12l3-3M17 12l-3-3M35 26h5M8 26h5" />
      </>
    ),
  },
  {
    id: 'fortuna',
    nombre: 'Ruleta de la suerte',
    lema: 'Gira y cobra lo que marque el gajo',
    ruta: '/casino/fortuna',
    icono: (
      <>
        <circle cx="24" cy="26" r="15" />
        <path d="M24 11v30M9 26h30M13.4 15.4l21.2 21.2M34.6 15.4L13.4 36.6" />
        <path d="M24 4l4 6h-8z" />
      </>
    ),
  },
  {
    id: 'duelo',
    nombre: 'Duelo de cartas',
    lema: 'Rojo contra azul · gana la más alta',
    ruta: '/casino/duelo',
    icono: (
      <>
        <rect x="6" y="12" width="16" height="24" rx="3" />
        <rect x="26" y="12" width="16" height="24" rx="3" />
        <path d="M24 18v12" />
      </>
    ),
  },
  {
    id: 'surf',
    nombre: 'Carrera de surf',
    lema: 'Seis tablas, una ola, un ganador',
    ruta: '/casino/surf',
    icono: (
      <>
        <path d="M6 32c4-3 7-3 11 0s7 3 11 0 7-3 11 0" />
        <path d="M6 39c4-3 7-3 11 0s7 3 11 0 7-3 11 0" />
        <path d="M31 9c-6 3-11 9-13 16l10 3c4-6 5-13 3-19z" />
      </>
    ),
  },
  {
    id: 'plinko',
    nombre: 'Plinko',
    lema: 'Doce rebotes y a ver dónde cae',
    ruta: '/casino/plinko',
    icono: (
      <>
        <path d="M24 6v6" />
        <circle cx="24" cy="17" r="1.6" />
        <circle cx="17" cy="25" r="1.6" />
        <circle cx="31" cy="25" r="1.6" />
        <circle cx="10" cy="33" r="1.6" />
        <circle cx="24" cy="33" r="1.6" />
        <circle cx="38" cy="33" r="1.6" />
        <path d="M7 41h34" />
      </>
    ),
  },
  {
    id: 'rasca',
    nombre: 'Rasca y gana',
    lema: 'Un raspón y a ver qué sale',
    ruta: '/casino/rasca',
    icono: (
      <>
        <rect x="8" y="13" width="32" height="22" rx="3" />
        <path d="M14 26l5-5 5 5 5-6 5 6" />
      </>
    ),
  },
];

function Mesa({ mesa }) {
  // Las mesas que ya funcionan son un enlace; las que no, una tarjeta muerta.
  // `Link` precarga la mesa al pasar el ratón por encima, así abrirla es instantáneo.
  const Envoltura = mesa.ruta ? Link : 'article';
  // Un `<article>` no entiende `href` ni `prefetch`, así que solo van cuando hay enlace.
  const enlace = mesa.ruta ? { href: mesa.ruta, prefetch: true } : {};

  return (
    <Envoltura className={`mesa ${mesa.ruta ? 'lista' : ''}`} {...enlace}>
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
      <span className={`mesa-pronto ${mesa.ruta ? 'abierta' : ''}`}>
        {mesa.ruta ? 'Jugar' : 'Próximamente'}
      </span>
    </Envoltura>
  );
}

export default function Casino({ usuario, admin, accesos, saldo: saldoInicial }) {
  const [turno, setTurno] = useState(null);
  const [saldo, setSaldo] = useState(saldoInicial);

  return (
    <div className="casino">
      <Barra
        usuario={usuario}
        admin={admin}
        accesos={accesos}
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
            Bienvenido de vuelta, <strong>{usuario}</strong>. Ya hay {MESAS.filter((m) => m.ruta).length}{' '}
            mesas abiertas.
          </p>

          <div className="casino-fichas">
            <span className="fichas-rotulo">Tus fichas</span>
            <span className="fichas-cifra">
              {new Intl.NumberFormat('es-CL').format(saldo)}
            </span>
          </div>

          <Retiro saldo={saldo} onSaldo={setSaldo} />
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
          Los resultados los sortea el servidor y las mesas usan las probabilidades de un
          casino real, con su ventaja de la casa: a la larga se pierde, como en cualquier
          casino. Las fichas son de rol — no valen dinero ni se pueden convertir en dinero.
        </p>
      </main>
    </div>
  );
}
