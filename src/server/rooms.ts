import { createClient } from '@supabase/supabase-js';
import { getPublicRuntimeMode } from '@/config/env';

export interface HallRoomSummary {
  code: string;
  lapTarget: number;
  trackName: string | null;
  playerCount: number;
  expiresAt: string;
}

/**
 * Reads the durable waiting-room projection from Supabase. The coordinator owns
 * room truth; this query is only for restoring the mobile hall list after refresh.
 */
export async function listWaitingRooms(): Promise<HallRoomSummary[]> {
  if (getPublicRuntimeMode() === 'demo') return [];

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return [];

  const supabase = createClient(url, anonKey);
  const { data, error } = await supabase
    .from('racing_rooms')
    .select('code, lap_target, track_name, expires_at, racing_room_players(player_id)')
    .eq('status', 'waiting')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(20);

  if (error || !data) return [];

  return data.map((room) => ({
    code: room.code,
    lapTarget: room.lap_target,
    trackName: room.track_name,
    playerCount: Array.isArray(room.racing_room_players) ? room.racing_room_players.length : 0,
    expiresAt: room.expires_at
  }));
}
