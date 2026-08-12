import { NextResponse } from 'next/server';
import { sesionActual } from '../../../../lib/servidor';
import { esAdmin, nombres } from '../../../../lib/usuarios';
import { ajustarSaldo, jugadasDe, todosLosSaldos } from '../../../../lib/fichas';
import { SALDO_INICIAL } from '../../../../lib/fichas-limites';

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

/** GET /api/casino/fichas → saldo de cada persona y últimas jugadas del casino. */
export async function GET() {
  const { corte } = await exigirAdmin();
  if (corte) return corte;

  try {
    const saldos = await todosLosSaldos();
    return NextResponse.json({
      cuentas: (await nombres()).map((u) => ({ usuario: u, saldo: saldos[u] ?? SALDO_INICIAL })),
      jugadas: await jugadasDe(null, 40),
    });
  } catch (e) {
    return NextResponse.json({ error: `No se pudo leer: ${e.message}` }, { status: 500 });
  }
}

/** POST /api/casino/fichas  body: { usuario, cantidad }. Positivo recarga, negativo quita. */
export async function POST(peticion) {
  const { sesion, corte } = await exigirAdmin();
  if (corte) return corte;

  const { usuario, cantidad } = await peticion.json().catch(() => ({}));
  if (!usuario) return NextResponse.json({ error: 'Falta el usuario.' }, { status: 400 });

  try {
    const { error, saldo } = await ajustarSaldo(usuario, cantidad, sesion.usuario);
    if (error) return NextResponse.json({ error }, { status: 400 });
    return NextResponse.json({ usuario, saldo });
  } catch (e) {
    return NextResponse.json({ error: `No se pudo guardar: ${e.message}` }, { status: 500 });
  }
}
