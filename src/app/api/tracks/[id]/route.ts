import { NextResponse } from 'next/server';
import { forwardSelfHostedRequest } from '@/server/selfHostedApi';

export const runtime = 'nodejs';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const url = new URL(request.url);
  const { id } = await params;
  const response = await forwardSelfHostedRequest(`/api/tracks/${encodeURIComponent(id)}${url.search}`, {
    method: 'GET'
  }).catch(() => null);

  if (!response) {
    return NextResponse.json({ ok: false, errorCode: 'COORDINATOR_NOT_READY' }, { status: 503 });
  }

  const body = await response.json().catch(() => ({ ok: false, errorCode: 'COORDINATOR_NOT_READY' }));
  return NextResponse.json(body, { status: response.status });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const body = await request.json().catch(() => null);
  const { id } = await params;
  const response = await forwardSelfHostedRequest(`/api/tracks/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body ?? {})
  }).catch(() => null);

  if (!response) {
    return NextResponse.json({ ok: false, errorCode: 'COORDINATOR_NOT_READY' }, { status: 503 });
  }

  const payload = await response.json().catch(() => ({ ok: false, errorCode: 'COORDINATOR_NOT_READY' }));
  return NextResponse.json(payload, { status: response.status });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const url = new URL(request.url);
  const { id } = await params;
  const response = await forwardSelfHostedRequest(`/api/tracks/${encodeURIComponent(id)}${url.search}`, {
    method: 'DELETE'
  }).catch(() => null);

  if (!response) {
    return NextResponse.json({ ok: false, errorCode: 'COORDINATOR_NOT_READY' }, { status: 503 });
  }

  const body = await response.json().catch(() => ({ ok: false, errorCode: 'COORDINATOR_NOT_READY' }));
  return NextResponse.json(body, { status: response.status });
}
