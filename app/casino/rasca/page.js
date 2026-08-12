import { redirect } from 'next/navigation';
import { sesionActual } from '../../../lib/servidor';
import { esAdmin, esCasino } from '../../../lib/usuarios';
import { saldoDe } from '../../../lib/fichas';
import Carton from './carton';

export const dynamic = 'force-dynamic';

export default async function Pagina() {
  const sesion = await sesionActual();
  if (!sesion) redirect('/login');
  if (!(await esCasino(sesion.usuario))) redirect('/');

  return (
    <Carton
      usuario={sesion.usuario}
      admin={await esAdmin(sesion.usuario)}
      saldoInicial={await saldoDe(sesion.usuario)}
    />
  );
}
