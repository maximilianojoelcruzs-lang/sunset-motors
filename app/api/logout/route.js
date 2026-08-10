import { NextResponse } from 'next/server';
import { COOKIE } from '../../../lib/sesion';

export async function POST() {
  const respuesta = NextResponse.json({ ok: true });
  respuesta.cookies.delete(COOKIE);
  return respuesta;
}
