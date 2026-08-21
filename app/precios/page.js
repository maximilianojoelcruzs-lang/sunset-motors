import { redirect } from 'next/navigation';
import { sesionDeTaller } from '../../lib/servidor';
import { obtener } from '../../lib/precios';
import { turnoAbierto } from '../../lib/turnos';
import Editor from './editor';

export const dynamic = 'force-dynamic';

export default async function PaginaPrecios() {
  const sesion = await sesionDeTaller();
  const { accesos } = sesion;
  if (!accesos.admin) redirect('/');

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
      accesos={accesos}
      catalogo={catalogo}
      sinEditar={catalogo.semilla}
      turnoPropio={abierto}
    />
  );
}
