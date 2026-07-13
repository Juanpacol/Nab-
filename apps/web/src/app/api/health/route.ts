import { NextResponse } from 'next/server';

/** Healthcheck de la web, usado por el HEALTHCHECK de docker/web.Dockerfile. */
export async function GET() {
  return NextResponse.json({ status: 'ok' });
}
