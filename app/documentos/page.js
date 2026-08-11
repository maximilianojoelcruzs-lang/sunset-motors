import { redirect } from 'next/navigation';
import { sesionActual } from '../../lib/servidor';
import { esAdmin } from '../../lib/usuarios';
import { listar } from '../../lib/documentos';
import { hayStorage } from '../../lib/imagenes';
import { turnoAbierto } from '../../lib/turnos';
import Documentos from './documentos';

export const dynamic = 'force-dynamic';

export default async function PaginaDocumentos() {
  const sesion = await sesionActual();
  if (!sesion) redirect('/login');

  let documentos = [];
  let abierto = null;
  let fallo = '';
  try {
    documentos = await listar();
    abierto = await turnoAbierto(sesion.usuario);
  } catch (e) {
    fallo = e.message;
  }

  return (
    <Documentos
      usuario={sesion.usuario}
      admin={await esAdmin(sesion.usuario)}
      iniciales={documentos}
      turnoPropio={abierto}
      conStorage={hayStorage()}
      fallo={fallo}
    />
  );
}
