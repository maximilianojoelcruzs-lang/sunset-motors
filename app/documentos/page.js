import { redirect } from 'next/navigation';
import { accesosDe, sesionDeTaller } from '../../lib/servidor';
import { listar, listarPara } from '../../lib/documentos';
import { hayStorage } from '../../lib/imagenes';
import { turnoAbierto } from '../../lib/turnos';
import { nombres } from '../../lib/usuarios';
import Documentos from './documentos';

export const dynamic = 'force-dynamic';

export default async function PaginaDocumentos() {
  const sesion = await sesionDeTaller();
  const accesos = await accesosDe(sesion.usuario);

  let documentos = [];
  let mecanicos = [];
  let abierto = null;
  let fallo = '';
  try {
    // El primer pintado también filtra: si mandara la lista entera y la escondiera después,
    // los documentos asignados viajarían igual dentro del HTML.
    documentos = accesos.admin ? await listar() : await listarPara(sesion.usuario);
    if (accesos.admin) mecanicos = await nombres();
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
      mecanicos={mecanicos}
      turnoPropio={abierto}
      conStorage={hayStorage()}
      fallo={fallo}
    />
  );
}
