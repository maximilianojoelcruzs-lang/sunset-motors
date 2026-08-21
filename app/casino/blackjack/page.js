import { sesionDeCasino } from '../../../lib/servidor';
import { saldoDe } from '../../../lib/fichas';
import { vista } from '../../../lib/blackjack';
import { partidaDe } from '../../../lib/blackjack-partida';
import Mesa from './mesa';

export const dynamic = 'force-dynamic';

export default async function Pagina() {
  const sesion = await sesionDeCasino();
  const { accesos } = sesion;

  const saldo = await saldoDe(sesion.usuario);

  // Una partida a medias se retoma: la apuesta ya está cobrada, así que dejarla botada sería
  // quedarse con las fichas sin repartir el final.
  const abierta = await partidaDe(sesion.usuario);

  return (
    <Mesa
      usuario={sesion.usuario}
      admin={accesos.admin}
      accesos={accesos}
      saldoInicial={saldo}
      partida={abierta ? vista(abierta, { saldo, cierre: null }) : null}
    />
  );
}
