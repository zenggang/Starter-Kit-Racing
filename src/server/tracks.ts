import type { TrackMapBounds } from '../../shared/trackMapValidation';

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

export type TrackServiceResult<T> = { ok: true; value: T } | { ok: false; errorCode: string };

export async function resolveCreateRoomTrackPayload(
  _ownerPlayerId: string,
  payload: Record<string, unknown>
): Promise<TrackServiceResult<Record<string, unknown>>> {
  return { ok: true, value: payload };
}
