import { NextResponse } from 'next/server';
import { sesionActual } from '../../../lib/servidor';
import { esAdmin } from '../../../lib/usuarios';
import { guardarWebhook, publica } from '../../../lib/config';
import { avisarDiscord } from '../../../lib/discord';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function exigirAdmin() {
  const sesion = await sesionActual();
  if (!sesion) return { corte: NextResponse.json({ error: 'Sin sesión.' }, { status: 401 }) };
  if (!(await esAdmin(sesion.usuario))) {
    return { corte: NextResponse.json({ error: 'No autorizado.' }, { status: 403 }) };
  }
  return { sesion };
}

/** GET /api/config → si hay webhook, sin devolver la URL. */
export async function GET() {
  const { corte } = await exigirAdmin();
  if (corte) return corte;

  try {
    return NextResponse.json({ config: await publica() });
  } catch (e) {
    return NextResponse.json({ error: `No se pudo leer: ${e.message}` }, { status: 500 });
  }
}

/** PUT /api/config  body: { discordWebhook }. Cadena vacía lo quita. */
export async function PUT(peticion) {
  const { sesion, corte } = await exigirAdmin();
  if (corte) return corte;

  const { discordWebhook } = await peticion.json().catch(() => ({}));

  try {
    const { error } = await guardarWebhook(discordWebhook, sesion.usuario);
    if (error) return NextResponse.json({ error }, { status: 400 });
    return NextResponse.json({ config: await publica() });
  } catch (e) {
    return NextResponse.json({ error: `No se pudo guardar: ${e.message}` }, { status: 500 });
  }
}

/** POST /api/config → manda un mensaje de prueba, para comprobar que el webhook sirve. */
export async function POST() {
  const { sesion, corte } = await exigirAdmin();
  if (corte) return corte;

  const { enviado, motivo } = await avisarDiscord(
    `✅ Prueba desde Sunset Motors, enviada por **${sesion.usuario}**. Si lees esto, los ` +
      'avisos de turno van a llegar bien.'
  );

  if (!enviado) {
    return NextResponse.json({ error: `No se pudo enviar: ${motivo}` }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
