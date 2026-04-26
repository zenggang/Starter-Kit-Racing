import { NextResponse } from 'next/server';
import { getServerCoordinatorConfig } from '@/config/env';
import { chooseCoordinatorMode } from '@/server/coordinatorPublicUrl';
import { signCoordinatorTicket } from '@/server/coordinatorTicket';

export const runtime = 'nodejs';

interface TicketRequestBody {
  playerId?: string;
  nickname?: string;
  roomCode?: string;
}

export async function POST(request: Request) {
  const config = getServerCoordinatorConfig();

  if (!config.ok) {
    return NextResponse.json({ ok: false, errorCode: config.errorCode, missing: config.missing }, { status: 503 });
  }

  const body = (await request.json().catch(() => ({}))) as TicketRequestBody;

  if (!body.playerId || !body.nickname) {
    return NextResponse.json({ ok: false, errorCode: 'AUTH_TICKET_INVALID' }, { status: 400 });
  }

  const mode = chooseCoordinatorMode(config.url, config.bridgeEnabled);
  if (!mode) {
    return NextResponse.json({ ok: false, errorCode: 'COORDINATOR_NOT_READY' }, { status: 503 });
  }

  const issuedAt = Date.now();
  const token = signCoordinatorTicket(
    {
      playerId: body.playerId,
      nickname: body.nickname,
      roomCode: body.roomCode?.toUpperCase(),
      issuedAt,
      expiresAt: issuedAt + 5 * 60 * 1000
    },
    config.sharedSecret
  );

  return NextResponse.json({
    ok: true,
    token,
    url: config.url,
    mode
  });
}
