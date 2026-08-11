'use client';

import { useEffect, useRef } from 'react';

/**
 * Ventana modal. Se usa en vez de páginas aparte a propósito: si el mecánico está armando
 * una boleta y navega a otra ruta, pierde todo lo que llevaba cargado — las cantidades
 * viven en memoria. Un diálogo lo deja mirar sus horas o cambiar su clave sin perder nada.
 */
export default function Dialogo({ titulo, onCerrar, children }) {
  const caja = useRef(null);

  useEffect(() => {
    const tecla = (e) => {
      if (e.key === 'Escape') onCerrar();
    };
    document.addEventListener('keydown', tecla);

    // Bloquear el scroll del fondo mientras está abierto.
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // El foco entra al diálogo para que el teclado no siga en la página de atrás.
    caja.current?.querySelector('input, button, [tabindex]')?.focus();

    return () => {
      document.removeEventListener('keydown', tecla);
      document.body.style.overflow = overflowPrevio;
    };
  }, [onCerrar]);

  return (
    <div
      className="velo"
      onMouseDown={(e) => {
        // Solo cierra si el clic empieza en el velo, no al arrastrar desde dentro.
        if (e.target === e.currentTarget) onCerrar();
      }}
    >
      <div className="dialogo" role="dialog" aria-modal="true" aria-label={titulo} ref={caja}>
        <div className="dialogo-cabeza">
          <h2 className="dialogo-titulo">{titulo}</h2>
          <button type="button" className="dialogo-cerrar" onClick={onCerrar} aria-label="Cerrar">
            ×
          </button>
        </div>
        <div className="dialogo-cuerpo">{children}</div>
      </div>
    </div>
  );
}
