import { redirect } from 'next/navigation';
import { sesionDeTaller } from '../../lib/servidor';
import { listarPara } from '../../lib/licencias';
import { turnoAbierto } from '../../lib/turnos';
import Licencias from './licencias';

export const dynamic = 'force-dynamic';

export default async function PaginaLicencias() {
  const sesion = await sesionDeTaller();

  const { accesos } = sesion;
  const { admin } = accesos;

  let mias = [];
  let pendientes = [];
  let abierto = null;
  let fallo = '';
  try {
    // Una sola lectura para las dos listas. El administrador ve además todo lo que le
    // enviaron; los borradores ajenos, nunca.
    ({ mias, enviadas: pendientes } = await listarPara(sesion.usuario, admin));
    abierto = await turnoAbierto(sesion.usuario);
  } catch (e) {
    fallo = e.message;
  }

  return (
    <Licencias
      usuario={sesion.usuario}
      admin={admin}
      accesos={accesos}
      miasIniciales={mias}
      todasIniciales={pendientes}
      turnoPropio={abierto}
      fallo={fallo}
    />
  );
}
