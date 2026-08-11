import { redirect } from 'next/navigation';
import { sesionDeTaller } from '../../lib/servidor';
import { esAdmin, listarUsuarios } from '../../lib/usuarios';
import { dondeGuarda } from '../../lib/almacen';
import { listar, turnoAbierto } from '../../lib/turnos';
import { publica } from '../../lib/config';
import Panel from './panel';

export const dynamic = 'force-dynamic';

// El rol se comprueba acá, no en el middleware: Edge no puede leer la base de datos.
export default async function PaginaAdmin() {
  const sesion = await sesionDeTaller();
  if (!(await esAdmin(sesion.usuario))) redirect('/');

  let turnos = [];
  let usuarios = [];
  let abierto = null;
  let fallo = '';
  try {
    turnos = await listar();
    usuarios = (await listarUsuarios()).map(({ usuario, admin }) => ({ usuario, admin }));
    // El menú de perfil de la barra también deja marcar desde acá.
    abierto = await turnoAbierto(sesion.usuario);
  } catch (e) {
    fallo = e.message;
  }

  return (
    <Panel
      turnosIniciales={turnos}
      usuariosIniciales={usuarios}
      turnoPropio={abierto}
      configInicial={await publica()}
      almacen={dondeGuarda()}
      fallo={fallo}
      quienSoy={sesion.usuario}
    />
  );
}
