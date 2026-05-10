import { NextResponse } from 'next/server';
import { forwardSelfHostedRequest } from '@/server/selfHostedApi';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const response = await forwardSelfHostedRequest(`/api/tracks${url.search}`, {
    method: 'GET'
  }).catch(() => null);

  if (!response) {
    return NextResponse.json({ ok: false, errorCode: 'COORDINATOR_NOT_READY' }, { status: 503 });
  }

  const body = await response.json().catch(() => ({ ok: false, errorCode: 'COORDINATOR_NOT_READY' }));
  return NextResponse.json(body, { status: response.status });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const response = await forwardSelfHostedRequest('/api/tracks', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body ?? {})
  }).catch(() => null);

  if (!response) {
    return NextResponse.json({ ok: false, errorCode: 'COORDINATOR_NOT_READY' }, { status: 503 });
  }

  const payload = await response.json().catch(() => ({ ok: false, errorCode: 'COORDINATOR_NOT_READY' }));
  return NextResponse.json(payload, { status: response.status });
}
