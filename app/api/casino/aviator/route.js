import { NextResponse } from 'next/server';
import { sesionActual } from '../../../../lib/servidor';
import { esCasino } from '../../../../lib/usuarios';
import { cobrar, pagar, validarApuesta } from '../../../../lib/fichas';
import {
  MINIMO,
  cerrarEn,
  limpiarAuto,
  multiplicadorEn,
  sortearChoque,
  yaTermino,
} from '../../../../lib/aviator';
import { borrarRonda, guardarRonda, rondaDe } from '../../../../lib/aviator-ronda';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const no = (mensaje, estado = 400) => NextResponse.json({ error: mensaje }, { status: estado });

/** Cierra el vuelo, paga lo que corresponda y lo deja anotado una sola vez. */
async function aterrizar(usuario, ronda, ahora) {
  const fin = cerrarEn(ronda, ahora);
  await borrarRonda(usuario);

  const { saldo, neto } = await pagar({
    usuario,
    juego: 'aviator',
    apuesta: ronda.apuesta,
    premio: fin.premio,
    detalle: fin.gano
      ? `Se retiró en x${fin.multiplicador}${fin.automatico ? ' (automático)' : ''} · se cayó en x${fin.choque}`
      : `Se cayó en x${fin.choque}`,
  });

  return { ...fin, saldo, neto, fase: 'fin' };
}

/**
 * Si quedó un vuelo abandonado —cerró la pestaña y no volvió— se resuelve al leerlo, igual
 * que los turnos vencidos. La apuesta ya está cobrada: dejarlo abierto sería quedarse con
 * las fichas sin dar el resultado.
 */
async function alDia(usuario) {
  const ronda = await rondaDe(usuario);
  if (!ronda) return { ronda: null, cierre: null };

  const ahora = Date.now();
  if (yaTermino(ronda, ahora)) return { ronda: null, cierre: await aterrizar(usuario, ronda, ahora) };
  return { ronda, cierre: null };
}

const enVuelo = (ronda) => ({
  fase: 'volando',
  inicio: ronda.inicio,
  servidor: Date.now(),
  apuesta: ronda.apuesta,
  auto: ronda.auto ?? null,
});

/** POST /api/casino/aviator  body: { accion: 'despegar'|'retirar'|'estado', apuesta, auto } */
export async function POST(peticion) {
  const sesion = await sesionActual();
  if (!sesion) return no('Sin sesión.', 401);
  if (!(await esCasino(sesion.usuario))) return no('No autorizado.', 403);

  const usuario = sesion.usuario;
  const { accion, apuesta, auto } = await peticion.json().catch(() => ({}));

  try {
    const { ronda, cierre } = await alDia(usuario);

    if (accion === 'estado') {
      if (cierre) return NextResponse.json(cierre);
      if (ronda) return NextResponse.json(enVuelo(ronda));
      return NextResponse.json({ fase: 'quieto' });
    }

    if (accion === 'despegar') {
      // Con un vuelo ya abierto se devuelve ese, sin cobrar otra apuesta.
      if (ronda) return NextResponse.json(enVuelo(ronda));
      if (cierre) return NextResponse.json(cierre);

      const validada = await validarApuesta(usuario, apuesta);
      if (validada.error) return no(validada.error);

      const limpio = limpiarAuto(auto);
      if (limpio?.error) return no(limpio.error);

      const nueva = {
        apuesta: validada.apuesta,
        choque: sortearChoque(),
        inicio: Date.now(),
        auto: limpio?.auto ?? null,
      };
      await guardarRonda(usuario, nueva);
      await cobrar(usuario, validada.apuesta);

      return NextResponse.json(enVuelo(nueva));
    }

    if (accion === 'retirar') {
      if (cierre) return NextResponse.json(cierre);
      if (!ronda) return no('No tienes ningún vuelo en el aire.');

      const ahora = Date.now();
      if (multiplicadorEn(ahora - ronda.inicio) < MINIMO) {
        return no(`Todavía no llega a ${MINIMO}.`);
      }
      return NextResponse.json(await aterrizar(usuario, ronda, ahora));
    }

    return no('Acción desconocida.');
  } catch (e) {
    return no(`No se pudo jugar: ${e.message}`, 500);
  }
}
