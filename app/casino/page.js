import { sesionDeCasino } from '../../lib/servidor';
import { saldoDe } from '../../lib/fichas';
import Casino from './casino';

export const dynamic = 'force-dynamic';

export default async function PaginaCasino() {
  // Entran los invitados del casino, los mecánicos con casino y los administradores.
  // Un mecánico común, no.
  const sesion = await sesionDeCasino();
  const { accesos } = sesion;

  return (
    <Casino
      usuario={sesion.usuario}
      admin={accesos.admin}
      accesos={accesos}
      saldo={await saldoDe(sesion.usuario)}
    />
  );
}
