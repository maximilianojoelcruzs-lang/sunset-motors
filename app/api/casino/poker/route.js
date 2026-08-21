import { NextResponse } from 'next/server';
import { exigirCasino } from '../../../../lib/servidor';
import { cobrar, pagar, validarApuesta, saldoDe } from '../../../../lib/fichas';
import { cambiar, evaluar, repartir } from '../../../../lib/poker';
import { borrarMano, guardarMano, manoPendiente } from '../../../../lib/poker-mano';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const no = (mensaje, estado) => NextResponse.json({ error: mensaje }, { status: estado });

/** POST /api/casino/poker  body: { accion: 'repartir'|'cambiar', apuesta, seQueda } */
export async function POST(peticion) {
  const { sesion, corte } = await exigirCasino();
  if (corte) return corte;

  const { accion, apuesta, seQueda } = await peticion.json().catch(() => ({}));

  try {
    if (accion === 'repartir') {
      // Idempotente: con una mano a medias la devuelve en vez de cobrar otra apuesta.
      const pendiente = await manoPendiente(sesion.usuario);
      if (pendiente) {
        return NextResponse.json({
          mano: pendiente.mano,
          apuesta: pendiente.apuesta,
          saldo: await saldoDe(sesion.usuario),
          reanudada: true,
        });
      }

      const validada = await validarApuesta(sesion.usuario, apuesta);
      if (validada.error) return no(validada.error, 400);

      const { mano, mazo } = repartir();
      await guardarMano(sesion.usuario, { mano, mazo, apuesta: validada.apuesta });
      const saldo = await cobrar(sesion.usuario, validada.apuesta);

      return NextResponse.json({ mano, apuesta: validada.apuesta, saldo });
    }

    if (accion === 'cambiar') {
      const pendiente = await manoPendiente(sesion.usuario);
      if (!pendiente) return no('No tienes una mano repartida.', 400);

      // Solo índices del 0 al 4, sin repetidos: lo demás sacaría cartas de la nada.
      const quedan = [
        ...new Set(
          (Array.isArray(seQueda) ? seQueda : [])
            .map(Number)
            .filter((i) => Number.isInteger(i) && i >= 0 && i <= 4)
        ),
      ];

      const final = cambiar(pendiente.mano, pendiente.mazo, quedan);
      const resultado = evaluar(final.mano);
      const premio = pendiente.apuesta * resultado.paga;

      await borrarMano(sesion.usuario);
      const { saldo, neto } = await pagar({
        usuario: sesion.usuario,
        juego: 'poker',
        apuesta: pendiente.apuesta,
        premio,
        detalle: `${resultado.nombre}${resultado.paga ? ` (x${resultado.paga})` : ''} · cambió ${5 - quedan.length}`,
      });

      return NextResponse.json({
        mano: final.mano,
        cambiadas: [0, 1, 2, 3, 4].filter((i) => !quedan.includes(i)),
        resultado,
        premio,
        saldo,
        neto,
        gano: premio > 0,
      });
    }

    return no('Acción desconocida.', 400);
  } catch (e) {
    return no(`No se pudo jugar: ${e.message}`, 500);
  }
}
