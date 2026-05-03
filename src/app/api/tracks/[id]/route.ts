import { NextResponse } from 'next/server';
import { deletePlayerTrack, getPlayerTrack, updatePlayerTrack } from '@/server/tracks';

export const runtime = 'nodejs';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const url = new URL(request.url);
  const playerId = url.searchParams.get('playerId')?.trim();
  if (!playerId) {
    return NextResponse.json({ ok: false, errorCode: 'AUTH_TICKET_INVALID' }, { status: 400 });
  }

  const { id } = await params;
  const result = await getPlayerTrack(playerId, id);
  if (!result.ok) {
    return NextResponse.json({ ok: false, errorCode: result.errorCode }, { status: result.errorCode === 'TRACK_NOT_FOUND' ? 404 : 503 });
  }

  return NextResponse.json({ ok: true, track: result.value });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const body = (await request.json().catch(() => null)) as { playerId?: string; name?: string; trackMap?: string } | null;
  if (!body?.playerId || !body.trackMap) {
    return NextResponse.json({ ok: false, errorCode: 'TRACK_MAP_INVALID' }, { status: 400 });
  }

  const { id } = await params;
  const result = await updatePlayerTrack(id, {
    ownerPlayerId: body.playerId,
    name: body.name ?? '',
    trackMap: body.trackMap
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, errorCode: result.errorCode }, { status: result.errorCode === 'TRACK_NOT_FOUND' ? 404 : 400 });
  }

  return NextResponse.json({ ok: true, track: result.value });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const url = new URL(request.url);
  const playerId = url.searchParams.get('playerId')?.trim();
  if (!playerId) {
    return NextResponse.json({ ok: false, errorCode: 'AUTH_TICKET_INVALID' }, { status: 400 });
  }

  const { id } = await params;
  const result = await deletePlayerTrack(playerId, id);
  if (!result.ok) {
    return NextResponse.json({ ok: false, errorCode: result.errorCode }, { status: result.errorCode === 'TRACK_NOT_FOUND' ? 404 : 400 });
  }

  return NextResponse.json({ ok: true });
}
