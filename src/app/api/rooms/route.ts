import { NextResponse } from 'next/server';
import { forwardSelfHostedRequest } from '@/server/selfHostedApi';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.search || '';
  const response = await forwardSelfHostedRequest(`/api/rooms${query}`, {
    method: 'GET'
  }).catch(() => null);

  if (!response) {
    return NextResponse.json({ ok: false, errorCode: 'COORDINATOR_NOT_READY', rooms: [] }, { status: 503 });
  }

  const body = await response.json().catch(() => ({ ok: false, rooms: [] }));
  return NextResponse.json(body, { status: response.status });
}

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const response = await forwardSelfHostedRequest('/api/rooms', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload ?? {})
  }).catch(() => null);

  if (!response) {
    return NextResponse.json({ ok: false, errorCode: 'COORDINATOR_NOT_READY' }, { status: 503 });
  }

  const body = await response.json().catch(() => ({ ok: false, errorCode: 'COORDINATOR_NOT_READY' }));
  return NextResponse.json(body, { status: response.status });
}
