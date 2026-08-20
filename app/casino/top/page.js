import { redirect } from 'next/navigation';
import { accesosDe, sesionActual } from '../../../lib/servidor';
import { ciclos, ranking } from '../../../lib/wager';
import TopWager from './top';

export const dynamic = 'force-dynamic';

export default async function PaginaTop() {
  const sesion = await sesionActual();
  if (!sesion) redirect('/login');

  // Igual que el resto del casino: entran los invitados, los mecánicos con casino y los admin.
  const accesos = await accesosDe(sesion.usuario);
  if (!accesos.casino) redirect('/');

  let inicial = { desde: null, puestos: [], total: 0 };
  let anteriores = [];
  let fallo = '';
  try {
    inicial = await ranking();
    anteriores = await ciclos();
  } catch (e) {
    fallo = e.message;
  }

  return (
    <TopWager
      usuario={sesion.usuario}
      admin={accesos.admin}
      accesos={accesos}
      inicial={inicial}
      ciclosIniciales={anteriores}
      fallo={fallo}
    />
  );
}
