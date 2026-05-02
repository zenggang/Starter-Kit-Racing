import { CELL_RAW, GRID_SCALE, TRACK_CELLS, computeTrackBounds, decodeCells } from '../../js/Track.js';
import type { MatchProgressPayload } from '@/realtime/protocol';
import type { RuntimeSnapshot } from './RacingRuntimeHost';

type Edge = 'N' | 'E' | 'S' | 'W';
type LegacyTrackCell = [number, number, string, number];

interface TrackPoint {
  x: number;
  z: number;
}

interface FinishLineAnchor {
  point: TrackPoint;
  normal: TrackPoint;
  checkpointIndex: number;
}

export interface TrackProgressModel {
  bounds: ReturnType<typeof computeTrackBounds>;
  points: TrackPoint[];
  checkpoints: number;
  totalLength: number;
  cumulativeLengths: number[];
  finishLine: FinishLineAnchor;
}

export interface LocalRaceProgressState {
  completedLaps: number;
  lastNormalizedProgress: number;
  lastCheckpoint: number;
  finished: boolean;
  finishSent: boolean;
  finishLineArmed: boolean;
  previousFinishProjection: null | number;
}

const ORIENT_TO_TURNS: Record<number, number> = {
  0: 0,
  16: 1,
  10: 2,
  22: 3
};

const EDGE_VECTORS: Record<Edge, { dx: number; dz: number }> = {
  N: { dx: 0, dz: -1 },
  E: { dx: 1, dz: 0 },
  S: { dx: 0, dz: 1 },
  W: { dx: -1, dz: 0 }
};

const BASE_CONNECTIONS: Record<string, readonly Edge[]> = {
  'track-straight': ['N', 'S'],
  'track-finish': ['N', 'S'],
  'track-bump': ['N', 'S'],
  'track-corner': ['W', 'S']
};

/**
 * The leaderboard and minimap only need a stable loop approximation, not the
 * full crashcat physics mesh. We therefore project the legacy GridMap cells
 * into ordered center points and derive progress from those checkpoints.
 */
export function buildTrackProgressModel(trackMap: string | null): TrackProgressModel {
  const cells = normalizeTrackCells(trackMap);
  const orderedCells = orderTrackCells(cells);
  const scale = CELL_RAW * GRID_SCALE;
  const points = orderedCells.map(([gx, gz]) => ({
    x: (gx + 0.5) * scale,
    z: (gz + 0.5) * scale
  }));

  const cumulativeLengths = [0];
  let totalLength = 0;

  for (let index = 0; index < points.length; index += 1) {
    const start = points[index];
    const end = points[(index + 1) % points.length];
    totalLength += Math.hypot(end.x - start.x, end.z - start.z);
    cumulativeLengths.push(totalLength);
  }

  const finishCheckpointIndex = Math.max(
    0,
    orderedCells.findIndex((cell) => cell[2] === 'track-finish')
  );
  const finishPoint = points[finishCheckpointIndex];
  const finishNextPoint = points[(finishCheckpointIndex + 1) % points.length];
  const finishNormal = normalizeVector({
    x: finishNextPoint.x - finishPoint.x,
    z: finishNextPoint.z - finishPoint.z
  });

  return {
    bounds: computeTrackBounds(cells),
    points,
    checkpoints: points.length,
    totalLength,
    cumulativeLengths,
    finishLine: {
      point: finishPoint,
      normal: finishNormal,
      checkpointIndex: finishCheckpointIndex
    }
  };
}

export function createInitialRaceProgressState(): LocalRaceProgressState {
  return {
    completedLaps: 0,
    lastNormalizedProgress: 0,
    lastCheckpoint: 0,
    finished: false,
    finishSent: false,
    finishLineArmed: false,
    previousFinishProjection: null
  };
}

/**
 * Samples the player's current location against the ordered centerline and
 * turns that into match telemetry that the coordinator can rank consistently.
 */
export function advanceRaceProgress(
  model: TrackProgressModel,
  state: LocalRaceProgressState,
  snapshot: RuntimeSnapshot,
  lapTarget: number
): { state: LocalRaceProgressState; payload: MatchProgressPayload } {
  const sample = sampleTrackProgress(model, snapshot.position);
  let completedLaps = state.completedLaps;
  let finishLineArmed = state.finishLineArmed || !isNearFinishLine(model, sample.checkpoint) || sample.normalizedProgress > 0.5;
  const finishProjection = signedFinishProjection(model, snapshot.position);

  if (
    finishLineArmed &&
    state.previousFinishProjection !== null &&
    state.previousFinishProjection < 0 &&
    finishProjection >= 0 &&
    isNearFinishLine(model, sample.checkpoint)
  ) {
    completedLaps += 1;
    finishLineArmed = false;
  }

  const finished = completedLaps >= lapTarget;
  const nextState: LocalRaceProgressState = {
    completedLaps: finished ? lapTarget : completedLaps,
    lastNormalizedProgress: finished ? 1 : sample.normalizedProgress,
    lastCheckpoint: sample.checkpoint,
    finished,
    finishSent: state.finishSent,
    finishLineArmed: finished ? false : finishLineArmed,
    previousFinishProjection: finishProjection
  };

  return {
    state: nextState,
    payload: {
      checkpoint: sample.checkpoint,
      completedLaps: finished ? lapTarget : completedLaps,
      lapProgress: finished ? 1 : sample.normalizedProgress,
      position: snapshot.position,
      heading: snapshot.heading,
      speed: snapshot.speed,
      finished
    }
  };
}

export function sampleTrackProgress(model: TrackProgressModel, position: RuntimeSnapshot['position']) {
  let closestDistance = Number.POSITIVE_INFINITY;
  let checkpoint = 0;
  let segmentProgress = 0;

  for (let index = 0; index < model.points.length; index += 1) {
    const start = model.points[index];
    const end = model.points[(index + 1) % model.points.length];
    const sample = projectPointOnSegment(position.x, position.z, start, end);

    if (sample.distance < closestDistance) {
      closestDistance = sample.distance;
      checkpoint = index;
      segmentProgress = sample.t;
    }
  }

  const travelled = model.cumulativeLengths[checkpoint] + segmentProgress * segmentLength(model, checkpoint);

  return {
    checkpoint,
    normalizedProgress: model.totalLength > 0 ? travelled / model.totalLength : 0
  };
}

function normalizeTrackCells(trackMap: string | null): LegacyTrackCell[] {
  if (!trackMap) {
    return TRACK_CELLS as LegacyTrackCell[];
  }

  try {
    return decodeCells(trackMap) as LegacyTrackCell[];
  } catch {
    return TRACK_CELLS as LegacyTrackCell[];
  }
}

function orderTrackCells(cells: LegacyTrackCell[]): LegacyTrackCell[] {
  const byKey = new Map<string, LegacyTrackCell>();
  cells.forEach((cell) => {
    byKey.set(cellKey(cell[0], cell[1]), cell);
  });

  const start = cells.find((cell) => cell[2] === 'track-finish') ?? cells[0];
  const startEdge = rotateEdge('S', ORIENT_TO_TURNS[start[3]] ?? 0);
  const ordered = [start];

  let previousKey: string | null = null;
  let current = start;
  let nextKey: string | null = neighbourKey(current[0], current[1], startEdge);

  while (nextKey && nextKey !== cellKey(start[0], start[1]) && ordered.length <= cells.length) {
    const nextCell = byKey.get(nextKey);
    if (!nextCell) break;

    ordered.push(nextCell);

    const currentKey = cellKey(current[0], current[1]);
    previousKey = currentKey;
    current = nextCell;

    const nextConnection = getCellConnections(current).find((edge) => neighbourKey(current[0], current[1], edge) !== previousKey);
    nextKey = nextConnection ? neighbourKey(current[0], current[1], nextConnection) : null;
  }

  return ordered.length === cells.length ? ordered : cells;
}

function getCellConnections(cell: LegacyTrackCell): Edge[] {
  const base = BASE_CONNECTIONS[cell[2]] ?? BASE_CONNECTIONS['track-straight'];
  const turns = ORIENT_TO_TURNS[cell[3]] ?? 0;
  return base.map((edge) => rotateEdge(edge, turns));
}

function rotateEdge(edge: Edge, turns: number): Edge {
  const order: Edge[] = ['N', 'W', 'S', 'E'];
  const currentIndex = order.indexOf(edge);
  return order[(currentIndex + turns) % order.length];
}

function neighbourKey(gx: number, gz: number, edge: Edge): string {
  const vector = EDGE_VECTORS[edge];
  return cellKey(gx + vector.dx, gz + vector.dz);
}

function cellKey(gx: number, gz: number): string {
  return `${gx},${gz}`;
}

function projectPointOnSegment(px: number, pz: number, start: TrackPoint, end: TrackPoint) {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const lengthSquared = dx * dx + dz * dz;
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((px - start.x) * dx + (pz - start.z) * dz) / lengthSquared));
  const projectedX = start.x + dx * t;
  const projectedZ = start.z + dz * t;

  return {
    t,
    distance: Math.hypot(px - projectedX, pz - projectedZ)
  };
}

function segmentLength(model: TrackProgressModel, index: number): number {
  const start = model.points[index];
  const end = model.points[(index + 1) % model.points.length];
  return Math.hypot(end.x - start.x, end.z - start.z);
}

function signedFinishProjection(model: TrackProgressModel, position: RuntimeSnapshot['position']): number {
  return (
    (position.x - model.finishLine.point.x) * model.finishLine.normal.x +
    (position.z - model.finishLine.point.z) * model.finishLine.normal.z
  );
}

function isNearFinishLine(model: TrackProgressModel, checkpoint: number): boolean {
  const distance = Math.abs(checkpoint - model.finishLine.checkpointIndex);
  return distance <= 1 || distance >= model.checkpoints - 1;
}

function normalizeVector(vector: TrackPoint): TrackPoint {
  const length = Math.hypot(vector.x, vector.z) || 1;
  return {
    x: vector.x / length,
    z: vector.z / length
  };
}
