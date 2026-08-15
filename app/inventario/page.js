import { accesosDe, sesionDeTaller } from '../../lib/servidor';
import { listar, listarCargas } from '../../lib/inventario';
import { turnoAbierto } from '../../lib/turnos';
import Inventario from './inventario';

export const dynamic = 'force-dynamic';

export default async function PaginaInventario() {
  const sesion = await sesionDeTaller();
  const accesos = await accesosDe(sesion.usuario);

  let articulos = [];
  let cargas = [];
  let fallo = '';
  try {
    articulos = await listar();
    cargas = await listarCargas();
  } catch (e) {
    fallo = e.message;
  }

  return (
    <Inventario
      usuario={sesion.usuario}
      admin={accesos.admin}
      accesos={accesos}
      iniciales={articulos}
      cargasIniciales={cargas}
      turnoPropio={await turnoAbierto(sesion.usuario).catch(() => null)}
      fallo={fallo}
    />
  );
}
