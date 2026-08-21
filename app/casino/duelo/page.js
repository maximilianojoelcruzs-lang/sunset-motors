import { sesionDeCasino } from '../../../lib/servidor';
import { saldoDe } from '../../../lib/fichas';
import Duelo from './duelo';

export const dynamic = 'force-dynamic';

export default async function Pagina() {
  const sesion = await sesionDeCasino();
  const { accesos } = sesion;

  return (
    <Duelo
      usuario={sesion.usuario}
      admin={accesos.admin}
      accesos={accesos}
      saldoInicial={await saldoDe(sesion.usuario)}
    />
  );
}
