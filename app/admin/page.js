import { redirect } from 'next/navigation';
import { sesionActual } from '../../lib/servidor';
import { esAdmin, listarUsuarios } from '../../lib/usuarios';
import { dondeGuarda } from '../../lib/almacen';
import { listar } from '../../lib/turnos';
import Panel from './panel';

export const dynamic = 'force-dynamic';

// El rol se comprueba acá, no en el middleware: Edge no puede leer la base de datos.
export default async function PaginaAdmin() {
  const sesion = await sesionActual();
  if (!sesion) redirect('/login');
  if (!(await esAdmin(sesion.usuario))) redirect('/');

  let turnos = [];
  let usuarios = [];
  let fallo = '';
  try {
    turnos = await listar();
    usuarios = (await listarUsuarios()).map(({ usuario, admin }) => ({ usuario, admin }));
  } catch (e) {
    fallo = e.message;
  }

  return (
    <Panel
      turnosIniciales={turnos}
      usuariosIniciales={usuarios}
      almacen={dondeGuarda()}
      fallo={fallo}
      quienSoy={sesion.usuario}
    />
  );
}
