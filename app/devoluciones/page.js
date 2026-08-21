import { redirect } from 'next/navigation';
import { sesionDeTaller } from '../../lib/servidor';
import { listarPara } from '../../lib/devoluciones';
import { hayStorage } from '../../lib/imagenes';
import { turnoAbierto } from '../../lib/turnos';
import Devoluciones from './devoluciones';

export const dynamic = 'force-dynamic';

export default async function PaginaDevoluciones() {
  const sesion = await sesionDeTaller();

  const { accesos } = sesion;
  const { admin } = accesos;

  let mias = [];
  let todas = [];
  let abierto = null;
  let fallo = '';
  try {
    // Una sola lectura para las dos listas.
    ({ mias, enviadas: todas } = await listarPara(sesion.usuario, admin));
    abierto = await turnoAbierto(sesion.usuario);
  } catch (e) {
    fallo = e.message;
  }

  return (
    <Devoluciones
      usuario={sesion.usuario}
      admin={admin}
      accesos={accesos}
      miasIniciales={mias}
      todasIniciales={todas}
      turnoPropio={abierto}
      conStorage={hayStorage()}
      fallo={fallo}
    />
  );
}
