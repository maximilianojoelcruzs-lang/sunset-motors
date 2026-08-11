'use client';

import { useState } from 'react';

/** Alta y baja de cuentas, para no depender de la línea de comandos ni de un despliegue. */
export default function Mecanicos({ iniciales, quienSoy }) {
  const [usuarios, setUsuarios] = useState(iniciales);
  const [abierto, setAbierto] = useState(false);
  const [usuario, setUsuario] = useState('');
  const [clave, setClave] = useState('');
  const [admin, setAdmin] = useState(false);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const recargar = async () => {
    const r = await fetch('/api/usuarios', { cache: 'no-store' });
    const cuerpo = await r.json().catch(() => ({}));
    if (r.ok) setUsuarios(cuerpo.usuarios);
  };

  const pedir = async (url, opciones, exito) => {
    setOcupado(true);
    setError('');
    setAviso('');
    try {
      const r = await fetch(url, opciones);
      const cuerpo = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(cuerpo.error || 'No se pudo completar.');
        return false;
      }
      setAviso(exito);
      await recargar();
      return true;
    } catch {
      setError('Sin conexión con el servidor.');
      return false;
    } finally {
      setOcupado(false);
    }
  };

  const crear = async (e) => {
    e.preventDefault();
    const ok = await pedir(
      '/api/usuarios',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario, clave, admin }),
      },
      `Cuenta "${usuario.trim().toLowerCase()}" creada. Pásale la clave a esa persona.`
    );
    if (ok) {
      setUsuario('');
      setClave('');
      setAdmin(false);
    }
  };

  const borrar = (nombre) => {
    if (!window.confirm(`¿Borrar la cuenta de ${nombre}? Sus turnos ya registrados se quedan.`)) {
      return;
    }
    pedir(`/api/usuarios/${nombre}`, { method: 'DELETE' }, `Cuenta "${nombre}" borrada.`);
  };

  const alternarAdmin = (u) =>
    pedir(
      `/api/usuarios/${u.usuario}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin: !u.admin }),
      },
      u.admin ? `"${u.usuario}" ya no es administrador.` : `"${u.usuario}" ahora es administrador.`
    );

  const nuevaClave = (nombre) => {
    const valor = window.prompt(`Clave nueva para ${nombre} (mínimo 8 caracteres):`);
    if (!valor) return;
    pedir(
      `/api/usuarios/${nombre}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clave: valor }),
      },
      `Clave de "${nombre}" cambiada. Avísale.`
    );
  };

  return (
    <section className="mecanicos">
      <button
        type="button"
        className="mecanicos-cabeza"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
      >
        <span className={`flecha ${abierto ? 'abierta' : ''}`} />
        <span className="ref-titulo">Mecánicos con cuenta</span>
        <span className="mecanicos-cuenta">{usuarios.length}</span>
      </button>

      {abierto && (
        <div className="mecanicos-cuerpo">
          {error && <p className="panel-error">{error}</p>}
          {aviso && <p className="mecanicos-aviso">{aviso}</p>}

          <ul className="mecanicos-lista">
            {usuarios.map((u) => (
              <li key={u.usuario}>
                <span className="mecanicos-nombre">
                  {u.usuario}
                  {u.admin && <span className="etiqueta-admin">admin</span>}
                  {u.usuario === quienSoy && <span className="etiqueta-yo">tú</span>}
                  {u.discord && <span className="etiqueta-yo">discord</span>}
                </span>
                <span className="fila-acciones">
                  <button
                    type="button"
                    className="accion"
                    disabled={ocupado}
                    onClick={() => {
                      const valor = window.prompt(
                        `ID de Discord de ${u.usuario} (solo números; vacío para quitarlo):`,
                        u.discord ?? ''
                      );
                      if (valor === null) return;
                      pedir(
                        `/api/usuarios/${u.usuario}`,
                        {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ discord: valor }),
                        },
                        valor.trim()
                          ? `Discord de "${u.usuario}" guardado.`
                          : `Se quitó el Discord de "${u.usuario}".`
                      );
                    }}
                  >
                    Discord
                  </button>
                  <button
                    type="button"
                    className="accion"
                    disabled={ocupado}
                    onClick={() => nuevaClave(u.usuario)}
                  >
                    Cambiar clave
                  </button>
                  <button
                    type="button"
                    className="accion"
                    disabled={ocupado || u.usuario === quienSoy}
                    onClick={() => alternarAdmin(u)}
                  >
                    {u.admin ? 'Quitar admin' : 'Hacer admin'}
                  </button>
                  <button
                    type="button"
                    className="accion peligro"
                    disabled={ocupado || u.usuario === quienSoy}
                    onClick={() => borrar(u.usuario)}
                  >
                    Borrar
                  </button>
                </span>
              </li>
            ))}
          </ul>

          <form className="mecanicos-alta" onSubmit={crear}>
            <label className="campo-inline">
              <span>Usuario nuevo</span>
              <input
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                placeholder="nombre.apellido"
                autoCapitalize="none"
                spellCheck={false}
                required
              />
            </label>
            <label className="campo-inline">
              <span>Clave inicial</span>
              <input
                type="text"
                value={clave}
                onChange={(e) => setClave(e.target.value)}
                placeholder="mínimo 8 caracteres"
                required
              />
            </label>
            <label className="campo-casilla">
              <input type="checkbox" checked={admin} onChange={(e) => setAdmin(e.target.checked)} />
              <span>Administrador</span>
            </label>
            <button type="submit" className="accion" disabled={ocupado}>
              Crear cuenta
            </button>
          </form>

          <p className="mecanicos-pie">
            La clave se guarda como hash: no vas a poder volver a verla. Si alguien la
            olvida, usa «Cambiar clave» y entrégale la nueva.
          </p>
        </div>
      )}
    </section>
  );
}
