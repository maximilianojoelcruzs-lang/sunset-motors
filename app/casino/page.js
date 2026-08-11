import { redirect } from 'next/navigation';
import { sesionActual } from '../../lib/servidor';
import { esAdmin, esCasino } from '../../lib/usuarios';
import Casino from './casino';

export const dynamic = 'force-dynamic';

export default async function PaginaCasino() {
  const sesion = await sesionActual();
  if (!sesion) redirect('/login');

  // Entran los invitados del casino y los administradores. Un mecánico común, no.
  if (!(await esCasino(sesion.usuario))) redirect('/');

  return <Casino usuario={sesion.usuario} admin={await esAdmin(sesion.usuario)} />;
}
