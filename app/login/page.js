'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Login() {
  const router = useRouter();
  const [usuario, setUsuario] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState('');
  const [sinUsuarios, setSinUsuarios] = useState(false);
  const [entrando, setEntrando] = useState(false);

  const entrar = async (e) => {
    e.preventDefault();
    setError('');
    setSinUsuarios(false);
    setEntrando(true);
    try {
      const r = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario, clave }),
      });
      if (!r.ok) {
        const cuerpo = await r.json().catch(() => ({}));
        setError(cuerpo.error || 'No se pudo entrar.');
        setSinUsuarios(r.status === 503);
        setEntrando(false);
        return;
      }
      router.replace('/');
      router.refresh();
    } catch {
      setError('Sin conexión con el servidor.');
      setEntrando(false);
    }
  };

  return (
    <>
      <div className="franja" />
      <main className="porton">
        <form className="porton-caja" onSubmit={entrar}>
          <h1 className="marca-nombre">
            SUNSET <em>MOTORS</em>
          </h1>
          <p className="marca-bajada">Acceso al taller</p>

          <label className="campo">
            <span>Usuario</span>
            <input
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              placeholder="tu.usuario"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={40}
              autoFocus
              required
            />
          </label>

          <label className="campo">
            <span>Clave</span>
            <input
              type="password"
              value={clave}
              onChange={(e) => setClave(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </label>

          {error && <p className="porton-error">{error}</p>}

          {sinUsuarios && (
            <p className="porton-arranque">
              La base de datos está vacía. Crea el primer administrador desde tu
              computador:
              {/* El "--" antes de --admin es obligatorio: sin él npm se come la bandera
                  y el usuario queda sin permisos de administrador. */}
              <code>npm run usuarios crear tu.usuario tu-clave -- --admin</code>
            </p>
          )}

          <button type="submit" className="porton-boton" disabled={entrando}>
            {entrando ? 'Abriendo…' : 'Entrar'}
          </button>

          <p className="porton-pie">
            Cada mecánico tiene su usuario. Tu nombre queda al pie de las boletas que
            emitas. Si no tienes uno, pídeselo al encargado del taller.
          </p>
        </form>
      </main>
    </>
  );
}
