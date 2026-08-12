import { redirect } from 'next/navigation';
import { accesosDe, sesionActual } from '../../../lib/servidor';
import { saldoDe } from '../../../lib/fichas';
import Vuelo from './vuelo';

export const dynamic = 'force-dynamic';

export default async function Pagina() {
  const sesion = await sesionActual();
  if (!sesion) redirect('/login');
  const accesos = await accesosDe(sesion.usuario);
  if (!accesos.casino) redirect('/');

  // El vuelo en curso NO se carga acá: se pregunta al montar. Traerlo desde el servidor
  // obligaría a mandar también en qué momento empezó, y con la página cacheada el avión
  // aparecería congelado en un multiplicador viejo.
  return (
    <Vuelo
      usuario={sesion.usuario}
      admin={accesos.admin}
      accesos={accesos}
      saldoInicial={await saldoDe(sesion.usuario)}
    />
  );
}
