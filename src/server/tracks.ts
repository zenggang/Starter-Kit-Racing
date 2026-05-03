import { createHash } from 'node:crypto';
import { validateTrackMap, type TrackMapBounds, type TrackMapErrorCode, type TrackMapValidationResult } from '../../shared/trackMapValidation';

type ServerTrackEnv = Record<string, string | undefined> & {
  NEXT_PUBLIC_SUPABASE_URL?: string;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
};

export interface RacingTrackSummary {
  id: string;
  ownerPlayerId: string;
  name: string;
  trackMap: string;
  trackHash: string;
  cellCount: number;
  bounds: TrackMapBounds;
  previewPoints: { x: number; z: number }[] | null;
  updatedAt: string;
  lastUsedAt: string | null;
}

export type TrackServiceResult<T> = { ok: true; value: T } | { ok: false; errorCode: 'COORDINATOR_NOT_READY' | 'TRACK_NOT_FOUND' | TrackMapErrorCode };

interface TrackRow {
  id: string;
  owner_player_id: string;
  name: string;
  track_map: string;
  track_hash: string;
  cell_count: number;
  bounds: RacingTrackSummary['bounds'];
  preview_points: RacingTrackSummary['previewPoints'];
  updated_at: string;
  last_used_at: string | null;
}

interface TrackCreateInput {
  ownerPlayerId: string;
  name: string;
  trackMap: string;
}

export async function listPlayerTracks(ownerPlayerId: string, env: ServerTrackEnv = process.env): Promise<RacingTrackSummary[]> {
  const client = createTrackRestClient(env);
  if (!client || !ownerPlayerId) return [];

  const rows = await client.request<TrackRow[]>(
    `racing_tracks?owner_player_id=eq.${encodeURIComponent(ownerPlayerId)}&deleted_at=is.null&select=id,owner_player_id,name,track_map,track_hash,cell_count,bounds,preview_points,updated_at,last_used_at&order=updated_at.desc`,
    'GET'
  );

  return rows.map(mapTrackRow);
}

export async function getPlayerTrack(ownerPlayerId: string, trackId: string, env: ServerTrackEnv = process.env): Promise<TrackServiceResult<RacingTrackSummary>> {
  const client = createTrackRestClient(env);
  if (!client) return { ok: false, errorCode: 'COORDINATOR_NOT_READY' };

  const rows = await client.request<TrackRow[]>(
    `racing_tracks?id=eq.${encodeURIComponent(trackId)}&owner_player_id=eq.${encodeURIComponent(ownerPlayerId)}&deleted_at=is.null&select=id,owner_player_id,name,track_map,track_hash,cell_count,bounds,preview_points,updated_at,last_used_at&limit=1`,
    'GET'
  );

  const row = rows[0];
  if (!row) return { ok: false, errorCode: 'TRACK_NOT_FOUND' };

  return { ok: true, value: mapTrackRow(row) };
}

export async function createPlayerTrack(input: TrackCreateInput, env: ServerTrackEnv = process.env): Promise<TrackServiceResult<RacingTrackSummary>> {
  const client = createTrackRestClient(env);
  if (!client) return { ok: false, errorCode: 'COORDINATOR_NOT_READY' };

  const validation = validateTrackMap(input.trackMap);
  if (!validation.ok) return { ok: false, errorCode: validation.errors[0] ?? 'TRACK_MAP_INVALID' };

  const timestamp = new Date().toISOString();
  const rows = await client.request<TrackRow[]>('racing_tracks', 'POST', [
    {
      owner_player_id: input.ownerPlayerId,
      name: normalizeTrackName(input.name),
      track_map: validation.normalizedTrackMap,
      track_hash: hashTrackMap(validation.normalizedTrackMap),
      cell_count: validation.cellCount,
      bounds: validation.bounds,
      preview_points: validation.cells.map((cell) => ({ x: cell.gx, z: cell.gz })),
      created_at: timestamp,
      updated_at: timestamp
    }
  ]);

  return { ok: true, value: mapTrackRow(rows[0]) };
}

export async function updatePlayerTrack(trackId: string, input: TrackCreateInput, env: ServerTrackEnv = process.env): Promise<TrackServiceResult<RacingTrackSummary>> {
  const client = createTrackRestClient(env);
  if (!client) return { ok: false, errorCode: 'COORDINATOR_NOT_READY' };

  const existing = await getPlayerTrack(input.ownerPlayerId, trackId, env);
  if (!existing.ok) return existing;

  const validation = validateTrackMap(input.trackMap);
  if (!validation.ok) return { ok: false, errorCode: validation.errors[0] ?? 'TRACK_MAP_INVALID' };

  const rows = await client.request<TrackRow[]>(
    `racing_tracks?id=eq.${encodeURIComponent(trackId)}&owner_player_id=eq.${encodeURIComponent(input.ownerPlayerId)}`,
    'PATCH',
    {
      name: normalizeTrackName(input.name),
      track_map: validation.normalizedTrackMap,
      track_hash: hashTrackMap(validation.normalizedTrackMap),
      cell_count: validation.cellCount,
      bounds: validation.bounds,
      preview_points: validation.cells.map((cell) => ({ x: cell.gx, z: cell.gz })),
      updated_at: new Date().toISOString()
    }
  );

  return { ok: true, value: mapTrackRow(rows[0]) };
}

export async function deletePlayerTrack(ownerPlayerId: string, trackId: string, env: ServerTrackEnv = process.env): Promise<TrackServiceResult<null>> {
  const client = createTrackRestClient(env);
  if (!client) return { ok: false, errorCode: 'COORDINATOR_NOT_READY' };

  const existing = await getPlayerTrack(ownerPlayerId, trackId, env);
  if (!existing.ok) return existing;

  await client.request<TrackRow[]>(
    `racing_tracks?id=eq.${encodeURIComponent(trackId)}&owner_player_id=eq.${encodeURIComponent(ownerPlayerId)}`,
    'PATCH',
    {
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  );

  return { ok: true, value: null };
}

export async function resolveCreateRoomTrackPayload(
  ownerPlayerId: string,
  payload: Record<string, unknown>,
  env: ServerTrackEnv = process.env
): Promise<TrackServiceResult<Record<string, unknown>>> {
  const trackId = typeof payload.trackId === 'string' && payload.trackId.trim() ? payload.trackId.trim() : null;
  if (!trackId) return { ok: true, value: payload };

  const track = await getPlayerTrack(ownerPlayerId, trackId, env);
  if (!track.ok) return track;

  const validation = validateTrackMap(track.value.trackMap);
  if (!validation.ok) return { ok: false, errorCode: validation.errors[0] ?? 'TRACK_MAP_INVALID' };

  return {
    ok: true,
    value: {
      ...payload,
      trackId: track.value.id,
      trackName: track.value.name,
      trackMap: validation.normalizedTrackMap
    }
  };
}

function createTrackRestClient(env: ServerTrackEnv) {
  const url = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;

  return {
    async request<T>(path: string, method: 'GET' | 'POST' | 'PATCH', body?: unknown): Promise<T> {
      const response = await fetch(`${url.replace(/\/$/, '')}/rest/v1/${path}`, {
        method,
        headers: {
          'content-type': 'application/json',
          apikey: serviceRoleKey,
          authorization: `Bearer ${serviceRoleKey}`,
          prefer: 'return=representation,resolution=merge-duplicates'
        },
        body: body === undefined ? undefined : JSON.stringify(body)
      });

      if (!response.ok) {
        throw new Error(`Supabase track request failed with ${response.status}`);
      }

      return (await response.json()) as T;
    }
  };
}

function mapTrackRow(row: TrackRow): RacingTrackSummary {
  return {
    id: row.id,
    ownerPlayerId: row.owner_player_id,
    name: row.name,
    trackMap: row.track_map,
    trackHash: row.track_hash,
    cellCount: row.cell_count,
    bounds: row.bounds,
    previewPoints: row.preview_points,
    updatedAt: row.updated_at,
    lastUsedAt: row.last_used_at
  };
}

function normalizeTrackName(name: string): string {
  const normalized = name.trim();
  return (normalized || '未命名赛道').slice(0, 40);
}

function hashTrackMap(trackMap: string): string {
  return createHash('sha256').update(trackMap).digest('hex');
}
