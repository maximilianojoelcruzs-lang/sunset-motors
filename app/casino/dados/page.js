import { sesionDeCasino } from '../../../lib/servidor';
import { saldoDe } from '../../../lib/fichas';
import Mesa from './mesa';

export const dynamic = 'force-dynamic';

export default async function Pagina() {
  const sesion = await sesionDeCasino();
  const { accesos } = sesion;

  return (
    <Mesa
      usuario={sesion.usuario}
      admin={accesos.admin}
      accesos={accesos}
      saldoInicial={await saldoDe(sesion.usuario)}
    />
  );
}
