'use client';

import { useState } from 'react';

export default function CambiarClave({ onListo }) {
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [repetida, setRepetida] = useState('');
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const enviar = async (e) => {
    e.preventDefault();
    setError('');

    // Se comprueba acá además de en el servidor solo para avisar antes de enviar; la
    // validación que manda es la del servidor.
    if (nueva !== repetida) {
      setError('Las dos claves nuevas no coinciden.');
      return;
    }

    setOcupado(true);
    try {
      const r = await fetch('/api/perfil/clave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actual, nueva }),
      });
      const cuerpo = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(cuerpo.error || 'No se pudo cambiar.');
        return;
      }
      onListo('Tu clave quedó cambiada. La próxima vez entra con la nueva.');
    } catch {
      setError('Sin conexión con el servidor.');
    } finally {
      setOcupado(false);
    }
  };

  return (
    <form className="forma" onSubmit={enviar}>
      <label className="campo">
        <span>Tu clave actual</span>
        <input
          type="password"
          value={actual}
          onChange={(e) => setActual(e.target.value)}
          autoComplete="current-password"
          required
        />
      </label>

      <label className="campo">
        <span>Clave nueva</span>
        <input
          type="password"
          value={nueva}
          onChange={(e) => setNueva(e.target.value)}
          autoComplete="new-password"
          minLength={8}
          placeholder="mínimo 8 caracteres"
          required
        />
      </label>

      <label className="campo">
        <span>Repite la clave nueva</span>
        <input
          type="password"
          value={repetida}
          onChange={(e) => setRepetida(e.target.value)}
          autoComplete="new-password"
          required
        />
      </label>

      {error && <p className="forma-error">{error}</p>}

      <button type="submit" className="porton-boton" disabled={ocupado}>
        {ocupado ? 'Guardando…' : 'Cambiar mi clave'}
      </button>

      <p className="forma-pie">
        Tu sesión sigue abierta después de cambiarla. La clave nueva se pide la próxima vez
        que entres.
      </p>
    </form>
  );
}
