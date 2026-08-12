'use client';

import { useState } from 'react';
import Link from 'next/link';
import Barra from '../barra';
import { FICHAS } from '../../lib/fichas-limites';

export const fmt = new Intl.NumberFormat('es-CL');
export const fichas = (n) => fmt.format(n);

/**
 * Lo que rodea a cualquier mesa: barra, fondo, cabecera con el saldo y el aviso legal.
 * Cada juego pone dentro solo lo suyo.
 */
export default function Sala({ usuario, admin, accesos, titulo, sub, saldo, aviso, children }) {
  const [turno, setTurno] = useState(null);

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

      <div className="casino-fondo" aria-hidden="true">
        <span className="casino-halo halo-1" />
        <span className="casino-halo halo-2" />
        <span className="casino-reja" />
      </div>

      <main className="casino-cuerpo">
        <header className="mesa-cabeza">
          <div>
            <Link className="mesa-volver" href="/casino" prefetch>
              ← Volver a las mesas
            </Link>
            <h1 className="mesa-titulo">{titulo}</h1>
            <p className="mesa-sub">{sub}</p>
          </div>
          <div className="casino-fichas">
            <span className="fichas-rotulo">Tus fichas</span>
            <span className="fichas-cifra">{fichas(saldo)}</span>
          </div>
        </header>

        {children}

        <p className="casino-aviso">{aviso}</p>
      </main>
    </div>
  );
}

/**
 * Selector de cuánto apostar, igual en todas las mesas.
 *
 * La cifra **se mira, no se escribe**: cambia solo al tocar una ficha. Antes era un campo
 * libre y se podía apostar 501, que es una cantidad que en una mesa no existe porque no hay
 * ninguna combinación de fichas que la forme. El servidor lo comprueba igual —la pantalla
 * nunca es la que decide—, pero acá ni siquiera se puede intentar.
 */
export function Apuesta({ apuesta, setApuesta, bloqueado, error, onJugar, texto }) {
  return (
    <div className="apuesta-caja">
      <div className="apuesta-fichas">
        {FICHAS.map((v) => (
          <button
            key={v}
            type="button"
            className={`ficha ${apuesta === v ? 'activa' : ''}`}
            disabled={bloqueado}
            onClick={() => setApuesta(v)}
          >
            {fichas(v)}
          </button>
        ))}
        <output className="apuesta-otro" aria-label="Cantidad apostada">
          {fichas(apuesta)}
        </output>
      </div>

      {error && <p className="apuesta-error">{error}</p>}

      <button type="button" className="apuesta-girar" onClick={onJugar} disabled={bloqueado}>
        {texto}
      </button>
    </div>
  );
}
