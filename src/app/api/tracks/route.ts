import { NextResponse } from 'next/server';
import { createPlayerTrack, listPlayerTracks } from '@/server/tracks';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const playerId = url.searchParams.get('playerId')?.trim();
  if (!playerId) {
    return NextResponse.json({ ok: false, errorCode: 'AUTH_TICKET_INVALID' }, { status: 400 });
  }

  return NextResponse.json({ ok: true, tracks: await listPlayerTracks(playerId) });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { playerId?: string; name?: string; trackMap?: string } | null;
  if (!body?.playerId || !body.trackMap) {
    return NextResponse.json({ ok: false, errorCode: 'TRACK_MAP_INVALID' }, { status: 400 });
  }

  const result = await createPlayerTrack({
    ownerPlayerId: body.playerId,
    name: body.name ?? '',
    trackMap: body.trackMap
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, errorCode: result.errorCode }, { status: result.errorCode === 'COORDINATOR_NOT_READY' ? 503 : 400 });
  }

  return NextResponse.json({ ok: true, track: result.value });
}
