import { redirect } from 'next/navigation';
import { sesionActual } from '../../lib/servidor';
import { esAdmin } from '../../lib/usuarios';
import { obtener } from '../../lib/bodega';
import { turnoAbierto } from '../../lib/turnos';
import Bodega from './bodega';

export const dynamic = 'force-dynamic';

export default async function PaginaBodega() {
  const sesion = await sesionActual();
  if (!sesion) redirect('/login');

  let bodega = { items: [], actualizado: null, actualizadoPor: null, anterior: null };
  let abierto = null;
  let fallo = '';
  try {
    bodega = await obtener();
    abierto = await turnoAbierto(sesion.usuario);
  } catch (e) {
    fallo = e.message;
  }

  return (
    <Bodega
      usuario={sesion.usuario}
      admin={await esAdmin(sesion.usuario)}
      inicial={{
        items: bodega.items,
        actualizado: bodega.actualizado,
        actualizadoPor: bodega.actualizadoPor,
        hayAnterior: Boolean(bodega.anterior),
      }}
      turnoPropio={abierto}
      fallo={fallo}
    />
  );
}
