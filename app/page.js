import { sesionActual } from '../lib/servidor';
import { esAdmin } from '../lib/usuarios';
import { turnoAbierto } from '../lib/turnos';
import Boleta from './boleta';

export const dynamic = 'force-dynamic';

// El middleware ya cortó el paso a quien no tiene sesión; acá solo armamos el contexto.
export default async function Pagina() {
  const sesion = await sesionActual();
  const usuario = sesion?.usuario ?? '';

  // Si la base falla, la calculadora igual tiene que abrir: cobrar es lo importante,
  // marcar turno es secundario.
  let abierto = null;
  let admin = false;
  try {
    if (usuario) {
      abierto = await turnoAbierto(usuario);
      admin = await esAdmin(usuario);
    }
  } catch {
    abierto = null;
  }

  return <Boleta nombre={usuario} admin={admin} turnoAbierto={abierto} />;
}
