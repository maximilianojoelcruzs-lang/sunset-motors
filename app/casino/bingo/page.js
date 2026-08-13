import { redirect } from 'next/navigation';
import { accesosDe, sesionActual } from '../../../lib/servidor';
import { saldoDe } from '../../../lib/fichas';
import Bingo from './bingo';

export const dynamic = 'force-dynamic';

export default async function Pagina() {
  const sesion = await sesionActual();
  if (!sesion) redirect('/login');
  const accesos = await accesosDe(sesion.usuario);
  if (!accesos.casino) redirect('/');

  // La ronda NO se carga acá: se pregunta al montar y se sigue consultando. Traerla desde el
  // servidor congelaría las bolas en el momento del pintado, y esta es la única mesa donde
  // el reloj corre para todos a la vez.
  return (
    <Bingo
      usuario={sesion.usuario}
      admin={accesos.admin}
      accesos={accesos}
      saldoInicial={await saldoDe(sesion.usuario)}
    />
  );
}
