import { NextResponse } from 'next/server';
import { exigirCasino } from '../../../../lib/servidor';
import { cobrar, pagar, saldoDe, validarApuesta } from '../../../../lib/fichas';
import { CASILLAS, esValido, maximasDe, pagoDe, sembrar } from '../../../../lib/mines';
import {
  guardarPartidaDe,
  leerPartidas,
  olvidarPartidaDe,
} from '../../../../lib/mines-partida';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const no = (mensaje, estado = 400) => NextResponse.json({ error: mensaje }, { status: estado });

/** Lo que ve el navegador mientras se juega: nunca dónde están las minas. */
const enJuego = (partida, saldo) => ({
  fase: 'jugando',
  minas: partida.minas,
  destapadas: partida.destapadas,
  apuesta: partida.apuesta,
  pago: pagoDe(partida.minas, partida.destapadas.length),
  siguiente: pagoDe(partida.minas, partida.destapadas.length + 1),
  maximas: maximasDe(partida.minas),
  saldo,
});

/** POST /api/casino/mines  body: { accion: 'empezar'|'destapar'|'cobrar', apuesta, minas, casilla } */
export async function POST(peticion) {
  const { sesion, corte } = await exigirCasino();
  if (corte) return corte;

  const usuario = sesion.usuario;
  const { accion, apuesta, minas, casilla } = await peticion.json().catch(() => ({}));

  try {
    // Una lectura del mapa para toda la petición, y una escritura al final.
    const todas = await leerPartidas();
    const partida = todas[usuario] ?? null;

    if (accion === 'empezar') {
      // Idempotente: con una partida abierta la devuelve en vez de cobrar otra apuesta.
      if (partida) return NextResponse.json(enJuego(partida, await saldoDe(usuario)));

      if (!esValido(minas)) return no('Ese número de minas no existe.');

      const validada = await validarApuesta(usuario, apuesta);
      if (validada.error) return no(validada.error);

      const nueva = {
        apuesta: validada.apuesta,
        minas: Math.round(Number(minas)),
        sembradas: sembrar(Math.round(Number(minas))),
        destapadas: [],
      };

      await guardarPartidaDe(usuario, nueva);
      const saldo = await cobrar(usuario, validada.apuesta);
      return NextResponse.json(enJuego(nueva, saldo));
    }

    if (!partida) return no('No tienes ninguna partida abierta.');

    if (accion === 'destapar') {
      const i = Math.round(Number(casilla));
      if (!Number.isInteger(i) || i < 0 || i >= CASILLAS) return no('Esa casilla no existe.');
      if (partida.destapadas.includes(i)) return no('Esa ya estaba destapada.');

      if (partida.sembradas.includes(i)) {
        // Se acabó. Recién ahora se enseñan las minas, y no antes.
        await olvidarPartidaDe(usuario);
        const { saldo, neto } = await pagar({
          usuario,
          juego: 'mines',
          apuesta: partida.apuesta,
          premio: 0,
          detalle: `${partida.minas} minas · voló en la casilla ${partida.destapadas.length + 1}`,
        });

        return NextResponse.json({
          fase: 'fin',
          gano: false,
          exploto: i,
          minas: partida.minas,
          sembradas: partida.sembradas,
          destapadas: partida.destapadas,
          apuesta: partida.apuesta,
          premio: 0,
          saldo,
          neto,
        });
      }

      const seguida = { ...partida, destapadas: [...partida.destapadas, i] };

      // Al llegar al tope —o a la última casilla limpia— se cobra solo: no queda nada que
      // decidir, y sin esto la escalera seguiría hasta pagos que rompen la economía.
      if (seguida.destapadas.length >= maximasDe(partida.minas)) {
        return cerrar(usuario, seguida, todas, 'llegó al tope');
      }

      await guardarPartidaDe(usuario, seguida);
      return NextResponse.json(enJuego(seguida, await saldoDe(usuario)));
    }

    if (accion === 'cobrar') {
      if (!partida.destapadas.length) return no('Destapa al menos una casilla.');
      return cerrar(usuario, partida, todas, `${partida.destapadas.length} limpias`);
    }

    return no('Acción desconocida.');
  } catch (e) {
    return no(`No se pudo jugar: ${e.message}`, 500);
  }
}

/** Cobra: paga lo que toque y enseña dónde estaban las minas. */
async function cerrar(usuario, partida, todas, porque) {
  const multiplicador = pagoDe(partida.minas, partida.destapadas.length);
  const premio = Math.round(partida.apuesta * multiplicador);

  await olvidarPartidaDe(usuario);
  const { saldo, neto } = await pagar({
    usuario,
    juego: 'mines',
    apuesta: partida.apuesta,
    premio,
    detalle: `${partida.minas} minas · ${porque} · x${multiplicador}`,
  });

  return NextResponse.json({
    fase: 'fin',
    gano: premio > partida.apuesta,
    exploto: null,
    minas: partida.minas,
    sembradas: partida.sembradas,
    destapadas: partida.destapadas,
    apuesta: partida.apuesta,
    multiplicador,
    premio,
    saldo,
    neto,
  });
}
