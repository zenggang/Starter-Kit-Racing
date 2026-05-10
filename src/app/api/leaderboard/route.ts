import { NextResponse } from 'next/server';
import { forwardSelfHostedRequest } from '@/server/selfHostedApi';

export const runtime = 'nodejs';

export async function GET() {
  const response = await forwardSelfHostedRequest('/api/leaderboard', {
    method: 'GET'
  }).catch(() => null);

  if (!response) {
    return NextResponse.json({ ok: false, errorCode: 'COORDINATOR_NOT_READY' }, { status: 503 });
  }

  const body = await response.json().catch(() => ({ ok: false, errorCode: 'COORDINATOR_NOT_READY' }));
  return NextResponse.json(body, { status: response.status });
}
