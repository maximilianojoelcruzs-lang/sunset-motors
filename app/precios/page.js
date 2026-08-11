import { redirect } from 'next/navigation';
import { sesionDeTaller } from '../../lib/servidor';
import { esAdmin } from '../../lib/usuarios';
import { obtener, esSemilla } from '../../lib/precios';
import { turnoAbierto } from '../../lib/turnos';
import Editor from './editor';

export const dynamic = 'force-dynamic';

export default async function PaginaPrecios() {
  const sesion = await sesionDeTaller();
  if (!(await esAdmin(sesion.usuario))) redirect('/');

  const catalogo = await obtener();

  let abierto = null;
  try {
    abierto = await turnoAbierto(sesion.usuario);
  } catch {
    abierto = null;
  }

  return (
    <Editor
      usuario={sesion.usuario}
      catalogo={catalogo}
      sinEditar={await esSemilla()}
      turnoPropio={abierto}
    />
  );
}
