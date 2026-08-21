import { NextResponse } from 'next/server';
import { COOKIE, firmarSesion, opcionesCookie, secretoFirma } from '../../../lib/sesion';
import { hayUsuarios, puertasDe, soloCasino, verificarUsuario } from '../../../lib/usuarios';
import { anotarFallo, equipoDe, olvidarFallos, puedeIntentar } from '../../../lib/intentos';
import { dondeGuarda } from '../../../lib/almacen';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(peticion) {
  const { usuario, clave } = await peticion.json().catch(() => ({}));

  if (!secretoFirma()) {
    return NextResponse.json(
      { error: 'Falta configurar SUNSET_SECRETO en el servidor.' },
      { status: 500 }
    );
  }

  if (!usuario || !clave) {
    return NextResponse.json({ error: 'Faltan el usuario o la clave.' }, { status: 400 });
  }

  try {
    if (!(await hayUsuarios())) {
      // Se informa el backend porque este estado casi siempre significa que la app está
      // mirando un almacén distinto al que se cree. Sin el dato, el mensaje manda a crear
      // un usuario que ya existe. Solo se expone cuando no hay ningún usuario, es decir,
      // cuando la instalación todavía no está configurada.
      return NextResponse.json(
        { error: 'Todavía no hay ningún usuario creado en este taller.', almacen: dondeGuarda() },
        { status: 503 }
      );
    }

    // Antes de mirar la clave: quien viene de fallar varias veces espera. Sin esto se podían
    // probar claves sin ningún límite, que es lo único que necesita un script.
    const equipo = equipoDe(peticion);
    const paso = await puedeIntentar(usuario, equipo);
    if (!paso.ok) {
      return NextResponse.json(
        { error: `Demasiados intentos fallidos. Espera ${paso.segundos} segundos.` },
        { status: 429, headers: { 'Retry-After': String(paso.segundos) } }
      );
    }

    const verificado = await verificarUsuario(usuario, clave);
    if (!verificado) {
      // El fallo se anota antes de responder: si no, no habría nada que contar.
      await anotarFallo(usuario, equipo);
      // Un solo mensaje para usuario inexistente y clave mala: no regalamos qué falló.
      return NextResponse.json({ error: 'Usuario o clave incorrectos.' }, { status: 401 });
    }

    // Entró: su contador vuelve a cero. El del equipo no, a propósito (ver lib/intentos.js).
    await olvidarFallos(verificado, equipo);

    // La clave era buena, pero la cuenta está suspendida. Se dice con esas palabras: un
    // «usuario o clave incorrectos» mandaría a la persona a probar claves que sí funcionan, y
    // a preguntarle al encargado por qué no entra.
    const puertas = await puertasDe(verificado);
    if (puertas.suspendida) {
      return NextResponse.json(
        { error: 'Esta cuenta está suspendida. Habla con el encargado del taller.' },
        { status: 403 }
      );
    }

    // Cada categoría entra por su puerta: a quien solo tiene casino, la calculadora del
    // taller no le sirve de nada.
    const destino = (await soloCasino(verificado)) ? '/casino' : '/';

    const respuesta = NextResponse.json({ ok: true, destino });
    respuesta.cookies.set(COOKIE, await firmarSesion(verificado), opcionesCookie());
    return respuesta;
  } catch (e) {
    return NextResponse.json(
      { error: `No se pudo consultar la base de usuarios: ${e.message}` },
      { status: 500 }
    );
  }
}
