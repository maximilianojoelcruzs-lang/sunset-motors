import { redirect } from 'next/navigation';
import { accesosDe, sesionActual } from '../../lib/servidor';
import { saldoDe } from '../../lib/fichas';
import Casino from './casino';

export const dynamic = 'force-dynamic';

export default async function PaginaCasino() {
  const sesion = await sesionActual();
  if (!sesion) redirect('/login');

  // Entran los invitados del casino, los mecánicos con casino y los administradores.
  // Un mecánico común, no.
  const accesos = await accesosDe(sesion.usuario);
  if (!accesos.casino) redirect('/');

  return (
    <Casino
      usuario={sesion.usuario}
      admin={accesos.admin}
      accesos={accesos}
      saldo={await saldoDe(sesion.usuario)}
    />
  );
}
