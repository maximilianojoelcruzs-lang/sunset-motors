import { sesionDeTaller } from '../lib/servidor';
import { esAdmin } from '../lib/usuarios';
import { turnoAbierto } from '../lib/turnos';
import { obtener } from '../lib/precios';
import Boleta from './boleta';

export const dynamic = 'force-dynamic';

// El middleware ya cortó el paso a quien no tiene sesión; acá solo armamos el contexto.
export default async function Pagina() {
  const sesion = await sesionDeTaller();
  const usuario = sesion?.usuario ?? '';

  // El catálogo sí es imprescindible: sin él no hay calculadora. Si falla, que falle.
  const { secciones } = await obtener();

  // Lo demás es secundario: si la base falla, la calculadora igual tiene que abrir.
  let abierto = null;
  let admin = false;
  try {
    if (usuario) {
      abierto = await turnoAbierto(usuario);
      admin = await esAdmin(usuario);
    }
  } catch {
    abierto = null;
  }

  return (
    <Boleta nombre={usuario} admin={admin} turnoAbierto={abierto} secciones={secciones} />
  );
}
