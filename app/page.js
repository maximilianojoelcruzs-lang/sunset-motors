import { sesionDeTaller } from '../lib/servidor';
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

  // Los accesos vienen con la sesión, de la misma lectura que ya comprobó la puerta.
  const accesos = sesion.accesos;

  // El turno sí es secundario: si la base falla, la calculadora igual tiene que abrir.
  let abierto = null;
  try {
    if (usuario) abierto = await turnoAbierto(usuario);
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
