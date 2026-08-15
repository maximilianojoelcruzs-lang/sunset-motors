import { accesosDe, sesionDeTaller } from '../../lib/servidor';
import { listar } from '../../lib/tunning';
import { turnoAbierto } from '../../lib/turnos';
import Tunning from './tunning';

export const dynamic = 'force-dynamic';

export default async function PaginaTunning() {
  const sesion = await sesionDeTaller();
  const accesos = await accesosDe(sesion.usuario);

  let pedidos = [];
  let abierto = null;
  let fallo = '';
  try {
    pedidos = await listar(sesion.usuario);
    abierto = await turnoAbierto(sesion.usuario);
  } catch (e) {
    fallo = e.message;
  }

  return (
    <Tunning
      usuario={sesion.usuario}
      admin={accesos.admin}
      accesos={accesos}
      iniciales={pedidos}
      turnoPropio={abierto}
      fallo={fallo}
    />
  );
}
