import { sesionDeCasino } from '../../../lib/servidor';
import { ciclos, ranking } from '../../../lib/wager';
import TopWager from './top';

export const dynamic = 'force-dynamic';

export default async function PaginaTop() {
  // Igual que el resto del casino: entran los invitados, los mecánicos con casino y los admin.
  const sesion = await sesionDeCasino();
  const { accesos } = sesion;

  let inicial = { desde: null, puestos: [], total: 0 };
  let anteriores = [];
  let fallo = '';
  try {
    inicial = await ranking();
    anteriores = await ciclos();
  } catch (e) {
    fallo = e.message;
  }

  return (
    <TopWager
      usuario={sesion.usuario}
      admin={accesos.admin}
      accesos={accesos}
      inicial={inicial}
      ciclosIniciales={anteriores}
      fallo={fallo}
    />
  );
}
