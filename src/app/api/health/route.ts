import { NextResponse } from 'next/server';
import { forwardSelfHostedRequest } from '@/server/selfHostedApi';

export const runtime = 'nodejs';

/**
 * Keep a same-origin health probe so Vercel and local Next.js deployments can
 * verify the ECS backend without exposing backend topology details to the UI.
 */
export async function GET() {
  const response = await forwardSelfHostedRequest('/api/health', {
    method: 'GET'
  }).catch(() => null);

  if (!response) {
    return NextResponse.json({ ok: false, errorCode: 'COORDINATOR_NOT_READY' }, { status: 503 });
  }

  const body = await response.json().catch(() => ({ ok: false, errorCode: 'COORDINATOR_NOT_READY' }));
  return NextResponse.json(body, { status: response.status });
}
