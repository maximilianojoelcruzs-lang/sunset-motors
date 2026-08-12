import { redirect } from 'next/navigation';
import { accesosDe, sesionActual } from '../../../lib/servidor';
import { saldoDe } from '../../../lib/fichas';
import Tablero from './tablero';

export const dynamic = 'force-dynamic';

export default async function Pagina() {
  const sesion = await sesionActual();
  if (!sesion) redirect('/login');
  const accesos = await accesosDe(sesion.usuario);
  if (!accesos.casino) redirect('/');

  return (
    <Tablero
      usuario={sesion.usuario}
      admin={accesos.admin}
      accesos={accesos}
      saldoInicial={await saldoDe(sesion.usuario)}
    />
  );
}
