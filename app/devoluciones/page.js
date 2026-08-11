import { redirect } from 'next/navigation';
import { sesionDeTaller } from '../../lib/servidor';
import { esAdmin } from '../../lib/usuarios';
import { listar, listarEnviadas } from '../../lib/devoluciones';
import { hayStorage } from '../../lib/imagenes';
import { turnoAbierto } from '../../lib/turnos';
import Devoluciones from './devoluciones';

export const dynamic = 'force-dynamic';

export default async function PaginaDevoluciones() {
  const sesion = await sesionDeTaller();

  const admin = await esAdmin(sesion.usuario);

  let mias = [];
  let todas = [];
  let abierto = null;
  let fallo = '';
  try {
    mias = await listar(sesion.usuario);
    if (admin) todas = await listarEnviadas();
    abierto = await turnoAbierto(sesion.usuario);
  } catch (e) {
    fallo = e.message;
  }

  return (
    <Devoluciones
      usuario={sesion.usuario}
      admin={admin}
      miasIniciales={mias}
      todasIniciales={todas}
      turnoPropio={abierto}
      conStorage={hayStorage()}
      fallo={fallo}
    />
  );
}
