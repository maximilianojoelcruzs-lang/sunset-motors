import { redirect } from 'next/navigation';
import { sesionActual } from '../../lib/servidor';
import { esAdmin } from '../../lib/usuarios';
import { listar, listarEnviadas } from '../../lib/licencias';
import { turnoAbierto } from '../../lib/turnos';
import Licencias from './licencias';

export const dynamic = 'force-dynamic';

export default async function PaginaLicencias() {
  const sesion = await sesionActual();
  if (!sesion) redirect('/login');

  const admin = await esAdmin(sesion.usuario);

  let mias = [];
  let pendientes = [];
  let abierto = null;
  let fallo = '';
  try {
    mias = await listar(sesion.usuario);
    // El administrador ve además todo lo que le enviaron. Los borradores ajenos, nunca.
    if (admin) pendientes = await listarEnviadas();
    abierto = await turnoAbierto(sesion.usuario);
  } catch (e) {
    fallo = e.message;
  }

  return (
    <Licencias
      usuario={sesion.usuario}
      admin={admin}
      miasIniciales={mias}
      todasIniciales={pendientes}
      turnoPropio={abierto}
      fallo={fallo}
    />
  );
}
