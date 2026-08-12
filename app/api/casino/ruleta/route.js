import { NextResponse } from 'next/server';
import { sesionActual } from '../../../../lib/servidor';
import { esCasino } from '../../../../lib/usuarios';
import { resolver, validarApuesta } from '../../../../lib/fichas';
import { color, girar, resolverApuesta } from '../../../../lib/ruleta';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/casino/ruleta  body: { tipo, valor, apuesta }
 *
 * **El número lo saca el servidor.** El navegador solo manda qué y cuánto apuesta; recibe
 * el número ya sorteado y lo anima. Si la tirada ocurriera en el cliente, cualquiera con
 * las herramientas de desarrollo se declararía ganador de todo.
 *
 * El descuento del saldo también es de acá: el cliente no resta nada.
 */
export async function POST(peticion) {
  const sesion = await sesionActual();
  if (!sesion) return NextResponse.json({ error: 'Sin sesión.' }, { status: 401 });
  if (!(await esCasino(sesion.usuario))) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });
  }

  const { tipo, valor, apuesta } = await peticion.json().catch(() => ({}));

  try {
    const validada = await validarApuesta(sesion.usuario, apuesta);
    if (validada.error) return NextResponse.json({ error: validada.error }, { status: 400 });

    const numero = girar();
    const jugada = resolverApuesta({
      tipo,
      valor,
      apuesta: validada.apuesta,
      numero,
    });
    if (jugada.error) return NextResponse.json({ error: jugada.error }, { status: 400 });

    const { saldo, neto } = await resolver({
      usuario: sesion.usuario,
      juego: 'ruleta',
      apuesta: validada.apuesta,
      premio: jugada.premio,
      detalle: `${jugada.etiqueta} · salió ${numero} ${color(numero)}`,
    });

    return NextResponse.json({
      numero,
      color: color(numero),
      gano: jugada.gano,
      premio: jugada.premio,
      neto,
      saldo,
      etiqueta: jugada.etiqueta,
    });
  } catch (e) {
    return NextResponse.json({ error: `No se pudo jugar: ${e.message}` }, { status: 500 });
  }
}
