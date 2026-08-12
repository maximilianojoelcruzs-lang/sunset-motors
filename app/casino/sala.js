'use client';

import { useState } from 'react';
import Link from 'next/link';
import Barra from '../barra';

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

/** Selector de cuánto apostar, igual en todas las mesas. */
export function Apuesta({ apuesta, setApuesta, minimo, bloqueado, error, onJugar, texto }) {
  return (
    <div className="apuesta-caja">
      <div className="apuesta-fichas">
        {[50, 100, 500, 1000].map((v) => (
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
        <input
          type="number"
          className="apuesta-otro"
          min={minimo}
          value={apuesta}
          disabled={bloqueado}
          onChange={(e) => setApuesta(Math.max(0, Number(e.target.value) || 0))}
          aria-label="Otra cantidad"
        />
      </div>

      {error && <p className="apuesta-error">{error}</p>}

      <button type="button" className="apuesta-girar" onClick={onJugar} disabled={bloqueado}>
        {texto}
      </button>
    </div>
  );
}
