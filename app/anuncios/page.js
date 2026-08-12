import { redirect } from 'next/navigation';
import { accesosDe, sesionDeTaller } from '../../lib/servidor';
import { listarFlyers, listarMensajes } from '../../lib/anuncios';
import { hayStorage } from '../../lib/imagenes';
import { turnoAbierto } from '../../lib/turnos';
import Anuncios from './anuncios';

export const dynamic = 'force-dynamic';

export default async function PaginaAnuncios() {
  const sesion = await sesionDeTaller();
  const accesos = await accesosDe(sesion.usuario);

  let flyers = [];
  let mensajes = [];
  let abierto = null;
  let fallo = '';
  try {
    flyers = await listarFlyers();
    mensajes = await listarMensajes();
    abierto = await turnoAbierto(sesion.usuario);
  } catch (e) {
    fallo = e.message;
  }

  return (
    <Anuncios
      usuario={sesion.usuario}
      admin={accesos.admin}
      accesos={accesos}
      flyersIniciales={flyers}
      mensajesIniciales={mensajes}
      turnoPropio={abierto}
      conStorage={hayStorage()}
      fallo={fallo}
    />
  );
}
