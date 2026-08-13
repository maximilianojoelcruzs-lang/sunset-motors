import { NextResponse } from 'next/server';
import { sesionActual } from '../../../../lib/servidor';
import { esAdmin, esCasino } from '../../../../lib/usuarios';
import { listar, listarDe, pedir } from '../../../../lib/retiros';
import { ADMINS, crearAviso } from '../../../../lib/avisos';
import { avisarDiscord } from '../../../../lib/discord';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/casino/retiros → las propias. Con `?todas=1` y siendo admin, todas.
 *
 * La separación es la misma de siempre: cada quien ve lo suyo, y la lista completa exige
 * ser administrador — verificado acá, no escondiendo un botón.
 */
export async function GET(peticion) {
  const sesion = await sesionActual();
  if (!sesion) return NextResponse.json({ error: 'Sin sesión.' }, { status: 401 });

  const todas = peticion.nextUrl.searchParams.get('todas') === '1';

  try {
    if (todas) {
      if (!(await esAdmin(sesion.usuario))) {
        return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });
      }
      return NextResponse.json({ retiros: await listar() });
    }
    return NextResponse.json({ retiros: await listarDe(sesion.usuario) });
  } catch (e) {
    return NextResponse.json({ error: `No se pudo leer: ${e.message}` }, { status: 500 });
  }
}

/** POST /api/casino/retiros  body: { fichas, nota } */
export async function POST(peticion) {
  const sesion = await sesionActual();
  if (!sesion) return NextResponse.json({ error: 'Sin sesión.' }, { status: 401 });
  if (!(await esCasino(sesion.usuario))) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 403 });
  }

  const { fichas, nota } = await peticion.json().catch(() => ({}));

  try {
    const { error, retiro, saldo } = await pedir(sesion.usuario, fichas, nota);
    if (error) return NextResponse.json({ error }, { status: 400 });

    // El aviso es el punto del asunto: si no llega, nadie entrega nada. Va envuelto para
    // que un webhook caído no deje al usuario sin fichas y sin solicitud.
    const texto = `${sesion.usuario} pide retirar ${retiro.fichas.toLocaleString('es-CL')} fichas.`;
    try {
      await crearAviso({ para: ADMINS, texto, enlace: '/admin' });
      await avisarDiscord(`💸 **Retiro pedido** — ${texto}${retiro.nota ? `\n> ${retiro.nota}` : ''}`);
    } catch {
      /* la solicitud ya está guardada; el aviso es un extra */
    }

    return NextResponse.json({ retiro, saldo });
  } catch (e) {
    return NextResponse.json({ error: `No se pudo pedir: ${e.message}` }, { status: 500 });
  }
}
