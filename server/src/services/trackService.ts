import { createHash, randomUUID } from 'node:crypto';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import { validateTrackMap, type TrackMapBounds } from '../../../shared/trackMapValidation.js';

export interface TrackSummary {
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

interface TrackRow extends RowDataPacket {
  id: string;
  owner_player_id: string;
  name: string;
  track_map: string;
  track_hash: string;
  cell_count: number;
  bounds_json: string;
  preview_points_json: string | null;
  updated_at: string;
  last_used_at: string | null;
}

export async function listTracks(pool: Pool, playerId: string): Promise<TrackSummary[]> {
  const [rows] = await pool.query<TrackRow[]>(
    `
      select id, owner_player_id, name, track_map, track_hash, cell_count,
             cast(bounds_json as char) as bounds_json,
             cast(preview_points_json as char) as preview_points_json,
             date_format(updated_at, '%Y-%m-%dT%H:%i:%sZ') as updated_at,
             if(last_used_at is null, null, date_format(last_used_at, '%Y-%m-%dT%H:%i:%sZ')) as last_used_at
      from racing_tracks
      where owner_player_id = ? and deleted_at is null
      order by updated_at desc
    `,
    [playerId]
  );

  return rows.map(mapTrackRow);
}

export async function getTrack(pool: Pool, playerId: string, trackId: string): Promise<TrackSummary | null> {
  const [rows] = await pool.query<TrackRow[]>(
    `
      select id, owner_player_id, name, track_map, track_hash, cell_count,
             cast(bounds_json as char) as bounds_json,
             cast(preview_points_json as char) as preview_points_json,
             date_format(updated_at, '%Y-%m-%dT%H:%i:%sZ') as updated_at,
             if(last_used_at is null, null, date_format(last_used_at, '%Y-%m-%dT%H:%i:%sZ')) as last_used_at
      from racing_tracks
      where owner_player_id = ? and id = ? and deleted_at is null
      limit 1
    `,
    [playerId, trackId]
  );

  return rows[0] ? mapTrackRow(rows[0]) : null;
}

export async function upsertTrack(
  pool: Pool,
  playerId: string,
  name: string,
  trackMap: string,
  trackId?: string
): Promise<TrackSummary> {
  const validation = validateTrackMap(trackMap);
  if (!validation.ok) {
    throw new Error(validation.errors[0] ?? 'TRACK_MAP_INVALID');
  }

  const normalizedName = normalizeTrackName(name);
  const normalizedTrackMap = validation.normalizedTrackMap;
  const id = trackId ?? randomUUID();
  const timestamp = toMysqlDatetime(new Date().toISOString()) as string;
  const previewPoints = validation.cells.map((cell) => ({ x: cell.gx, z: cell.gz }));

  await pool.execute(
    `
      insert into racing_tracks (
        id, owner_player_id, name, track_map, track_hash, cell_count,
        bounds_json, preview_points_json, created_at, updated_at, last_used_at, deleted_at
      )
      values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, null, null)
      on duplicate key update
        name = values(name),
        track_map = values(track_map),
        track_hash = values(track_hash),
        cell_count = values(cell_count),
        bounds_json = values(bounds_json),
        preview_points_json = values(preview_points_json),
        updated_at = values(updated_at),
        deleted_at = null
    `,
    [
      id,
      playerId,
      normalizedName,
      normalizedTrackMap,
      createHash('sha256').update(normalizedTrackMap).digest('hex'),
      validation.cellCount,
      JSON.stringify(validation.bounds),
      JSON.stringify(previewPoints),
      timestamp,
      timestamp
    ]
  );

  const track = await getTrack(pool, playerId, id);
  if (!track) {
    throw new Error('TRACK_NOT_FOUND');
  }

  return track;
}

export async function softDeleteTrack(pool: Pool, playerId: string, trackId: string): Promise<boolean> {
  const [result] = await pool.execute(
    `
      update racing_tracks
      set deleted_at = ?, updated_at = ?
      where owner_player_id = ? and id = ? and deleted_at is null
    `,
    [toMysqlDatetime(new Date().toISOString()), toMysqlDatetime(new Date().toISOString()), playerId, trackId]
  );

  return (result as { affectedRows?: number }).affectedRows === 1;
}

function mapTrackRow(row: TrackRow): TrackSummary {
  return {
    id: row.id,
    ownerPlayerId: row.owner_player_id,
    name: row.name,
    trackMap: row.track_map,
    trackHash: row.track_hash,
    cellCount: row.cell_count,
    bounds: JSON.parse(row.bounds_json) as TrackMapBounds,
    previewPoints: row.preview_points_json ? (JSON.parse(row.preview_points_json) as { x: number; z: number }[]) : null,
    updatedAt: row.updated_at,
    lastUsedAt: row.last_used_at
  };
}

function normalizeTrackName(name: string): string {
  const normalized = name.trim();
  return (normalized || '未命名赛道').slice(0, 40);
}

function toMysqlDatetime(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.slice(0, 19).replace('T', ' ');
}
