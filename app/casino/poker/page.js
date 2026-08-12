import { redirect } from 'next/navigation';
import { accesosDe, sesionActual } from '../../../lib/servidor';
import { saldoDe } from '../../../lib/fichas';
import { manoPendiente } from '../../../lib/poker-mano';
import Mesa from './mesa';

export const dynamic = 'force-dynamic';

export default async function Pagina() {
  const sesion = await sesionActual();
  if (!sesion) redirect('/login');
  const accesos = await accesosDe(sesion.usuario);
  if (!accesos.casino) redirect('/');

  // Si dejó una mano a medias —cerró la pestaña entre el reparto y el cambio— se retoma:
  // la apuesta ya está cobrada, así que abandonarla sería quitarle las fichas por nada.
  // El resto del mazo se queda en el servidor y no viaja acá.
  const pendiente = await manoPendiente(sesion.usuario);

  return (
    <Mesa
      usuario={sesion.usuario}
      admin={accesos.admin}
      accesos={accesos}
      saldoInicial={await saldoDe(sesion.usuario)}
      pendiente={pendiente ? { mano: pendiente.mano, apuesta: pendiente.apuesta } : null}
    />
  );
}
