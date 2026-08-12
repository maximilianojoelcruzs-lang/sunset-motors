import { redirect } from 'next/navigation';
import { accesosDe, sesionDeTaller } from '../../lib/servidor';
import { listarUsuarios } from '../../lib/usuarios';
import { dondeGuarda } from '../../lib/almacen';
import { listar, turnoAbierto } from '../../lib/turnos';
import { publica } from '../../lib/config';
import Panel from './panel';

export const dynamic = 'force-dynamic';

// El rol se comprueba acá, no en el middleware: Edge no puede leer la base de datos.
export default async function PaginaAdmin() {
  const sesion = await sesionDeTaller();
  const accesos = await accesosDe(sesion.usuario);
  if (!accesos.admin) redirect('/');

  let turnos = [];
  let usuarios = [];
  let abierto = null;
  let fallo = '';
  try {
    turnos = await listar();
    // Nunca la sal ni el hash: solo lo que el panel necesita enseñar.
    usuarios = (await listarUsuarios()).map(({ usuario, admin, casino, taller, discord }) => ({
      usuario,
      admin: Boolean(admin),
      casino: Boolean(casino),
      taller: !casino || Boolean(taller),
      discord: discord ?? null,
    }));
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
      accesos={accesos}
    />
  );
}
