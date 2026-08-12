import { redirect } from 'next/navigation';
import { accesosDe, sesionDeTaller } from '../../lib/servidor';
import { listar } from '../../lib/documentos';
import { hayStorage } from '../../lib/imagenes';
import { turnoAbierto } from '../../lib/turnos';
import Documentos from './documentos';

export const dynamic = 'force-dynamic';

export default async function PaginaDocumentos() {
  const sesion = await sesionDeTaller();
  const accesos = await accesosDe(sesion.usuario);

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
      admin={accesos.admin}
      accesos={accesos}
      iniciales={documentos}
      turnoPropio={abierto}
      conStorage={hayStorage()}
      fallo={fallo}
    />
  );
}
