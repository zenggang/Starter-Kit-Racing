import { NextResponse } from 'next/server';
import { listWaitingRooms } from '@/server/rooms';

export async function GET() {
  return NextResponse.json({ rooms: await listWaitingRooms() });
}
