'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Login() {
  const router = useRouter();
  const [usuario, setUsuario] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState('');
  const [sinUsuarios, setSinUsuarios] = useState(false);
  const [almacen, setAlmacen] = useState('');
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
        setAlmacen(cuerpo.almacen ?? '');
        setEntrando(false);
        return;
      }
      const { destino } = await r.json().catch(() => ({}));
      router.replace(destino || '/');
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

          {sinUsuarios && almacen !== 'archivo' && (
            <p className="porton-arranque">
              No hay usuarios en la base ({almacen}). Crea el primer administrador desde tu
              computador:
              {/* El "--" antes de --admin es obligatorio: sin él npm se come la bandera
                  y el usuario queda sin permisos de administrador. */}
              <code>npm run usuarios crear tu.usuario tu-clave -- --admin</code>
            </p>
          )}

          {sinUsuarios && almacen === 'archivo' && (
            <p className="porton-arranque">
              Este servidor está guardando en <b>archivo local</b>, no en una base de datos.
              Si esperabas Supabase, faltan sus variables de entorno acá: revisa que
              <code>SUPABASE_URL</code>
              <code>SUPABASE_SERVICE_ROLE_KEY</code>
              existan, estén marcadas para este entorno, y vuelve a desplegar.
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
