import { NextResponse } from 'next/server';
import { getServerCoordinatorConfig } from '@/config/env';
import { syncCoordinatorReadModels } from '@/server/readModelWriter';
import { verifyCoordinatorTicket } from '@/server/coordinatorTicket';

export const runtime = 'nodejs';

export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const config = getServerCoordinatorConfig();

  if (!config.ok) {
    return NextResponse.json({ ok: false, errorCode: config.errorCode }, { status: 503 });
  }

  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const ticket = token ? verifyCoordinatorTicket(token, config.sharedSecret) : null;
  if (!ticket) {
    return NextResponse.json({ ok: false, errorCode: 'AUTH_TICKET_INVALID' }, { status: 401 });
  }

  const { code } = await params;
  const payload = await request.json().catch(() => null);
  const isCreate = payload && typeof payload === 'object' && (payload as { type?: string }).type === 'room.create';
  const commandType = payload && typeof payload === 'object' ? (payload as { type?: string }).type : undefined;
  const coordinatorPath = isCreate ? '/rooms' : `/rooms/${encodeURIComponent(code.toUpperCase())}/commands`;
  const coordinatorCommand = injectCoordinatorAuth(payload, ticket);

  const response = await fetch(`${config.url.replace(/\/$/, '')}${coordinatorPath}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`
    },
    body: JSON.stringify(coordinatorCommand)
  }).catch(() => null);

  if (!response) {
    return NextResponse.json({ ok: false, errorCode: 'COORDINATOR_NOT_READY' }, { status: 503 });
  }

  const body = await response.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ ok: false, errorCode: 'COORDINATOR_NOT_READY' }, { status: 503 });
  }

  await syncCoordinatorReadModels({ type: commandType }, body).catch(() => {
    // Hall restoration is a durability convenience; bridge command success
    // should still reach the browser even if the read-model write fails.
  });

  return NextResponse.json(body, {
    status: response.status
  });
}

function injectCoordinatorAuth(payload: unknown, ticket: NonNullable<ReturnType<typeof verifyCoordinatorTicket>>) {
  const command = payload && typeof payload === 'object' ? { ...(payload as Record<string, unknown>) } : {};
  const commandPayload = command.payload && typeof command.payload === 'object' ? { ...(command.payload as Record<string, unknown>) } : {};

  if ((command.type === 'room.create' || command.type === 'room.join') && !commandPayload.nickname) {
    commandPayload.nickname = ticket.nickname;
  }

  return {
    ...command,
    playerId: command.playerId || ticket.playerId,
    authTicket: {
      playerId: ticket.playerId,
      roomCode: ticket.roomCode,
      issuedAt: ticket.issuedAt,
      expiresAt: ticket.expiresAt
    },
    payload: commandPayload
  };
}
