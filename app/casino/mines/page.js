import { sesionDeCasino } from '../../../lib/servidor';
import { saldoDe } from '../../../lib/fichas';
import { maximasDe, pagoDe } from '../../../lib/mines';
import { partidaDe } from '../../../lib/mines-partida';
import Campo from './campo';

export const dynamic = 'force-dynamic';

export default async function Pagina() {
  const sesion = await sesionDeCasino();
  const { accesos } = sesion;

  // Una partida a medias se retoma: la apuesta ya está cobrada, así que abandonarla sería
  // quedarse con las fichas. **Las minas no viajan** — solo lo que ya está destapado.
  const abierta = await partidaDe(sesion.usuario);

  return (
    <Campo
      usuario={sesion.usuario}
      admin={accesos.admin}
      accesos={accesos}
      saldoInicial={await saldoDe(sesion.usuario)}
      partida={
        abierta
          ? {
              fase: 'jugando',
              minas: abierta.minas,
              destapadas: abierta.destapadas,
              apuesta: abierta.apuesta,
              pago: pagoDe(abierta.minas, abierta.destapadas.length),
              siguiente: pagoDe(abierta.minas, abierta.destapadas.length + 1),
              maximas: maximasDe(abierta.minas),
            }
          : null
      }
    />
  );
}
