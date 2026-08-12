import { accesosDe, sesionDeTaller } from '../lib/servidor';
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
  let accesos = { admin: false, casino: false, taller: true };
  try {
    if (usuario) {
      abierto = await turnoAbierto(usuario);
      accesos = await accesosDe(usuario);
    }
  } catch {
    abierto = null;
  }

  return (
    <Boleta
      nombre={usuario}
      admin={accesos.admin}
      accesos={accesos}
      turnoAbierto={abierto}
      secciones={secciones}
    />
  );
}
