export const TRACK_TILE_TYPES = ['track-straight', 'track-corner', 'track-bump', 'track-finish'] as const;
export const TRACK_ORIENTATIONS = [0, 10, 16, 22] as const;
export const TRACK_MAP_MIN_CELLS = 8;
export const TRACK_MAP_MAX_CELLS = 192;
export const TRACK_MAP_MIN_COORD = -64;
export const TRACK_MAP_MAX_COORD = 63;

export type TrackTileType = (typeof TRACK_TILE_TYPES)[number];
export type TrackOrientation = (typeof TRACK_ORIENTATIONS)[number];
export type TrackCellTuple = readonly [number, number, TrackTileType, TrackOrientation];

export type TrackMapErrorCode =
  | 'TRACK_MAP_INVALID'
  | 'TRACK_MAP_TOO_SMALL'
  | 'TRACK_MAP_TOO_LARGE'
  | 'TRACK_MAP_COORDS_OUT_OF_RANGE'
  | 'TRACK_MAP_DUPLICATE_CELL'
  | 'TRACK_MAP_FINISH_MISSING'
  | 'TRACK_MAP_FINISH_DUPLICATE'
  | 'TRACK_MAP_NOT_CONNECTED'
  | 'TRACK_MAP_NOT_CLOSED_LOOP'
  | 'TRACK_MAP_UNSUPPORTED_TILE';

export interface ValidatedTrackCell {
  gx: number;
  gz: number;
  type: TrackTileType;
  orient: TrackOrientation;
}

export interface TrackMapBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  centerX: number;
  centerZ: number;
  halfWidth: number;
  halfDepth: number;
}

export interface TrackSpawn {
  position: [number, number, number];
  angle: number;
}

export type TrackMapValidationResult =
  | {
      ok: true;
      normalizedTrackMap: string;
      cells: ValidatedTrackCell[];
      cellCount: number;
      bounds: TrackMapBounds;
      finishCell: ValidatedTrackCell;
      spawn: TrackSpawn;
      errors: [];
    }
  | {
      ok: false;
      errors: TrackMapErrorCode[];
    };

type Edge = 'N' | 'E' | 'S' | 'W';

const CELL_RAW = 9.99;
const GRID_SCALE = 0.75;
const ORIENT_DEG: Record<TrackOrientation, number> = { 0: 0, 10: 180, 16: 90, 22: 270 };
const TYPE_INDEX: Record<TrackTileType, number> = {
  'track-straight': 0,
  'track-corner': 1,
  'track-bump': 2,
  'track-finish': 3
};
const INDEX_TYPE = TRACK_TILE_TYPES;
const ORIENT_TO_INDEX: Record<TrackOrientation, number> = { 0: 0, 16: 1, 10: 2, 22: 3 };
const INDEX_TO_ORIENT: TrackOrientation[] = [0, 16, 10, 22];
const ORIENT_TO_TURNS: Record<TrackOrientation, number> = { 0: 0, 16: 1, 10: 2, 22: 3 };
const BASE_CONNECTIONS: Record<TrackTileType, readonly Edge[]> = {
  'track-straight': ['N', 'S'],
  'track-finish': ['N', 'S'],
  'track-bump': ['N', 'S'],
  'track-corner': ['W', 'S']
};
const EDGE_VECTORS: Record<Edge, { dx: number; dz: number }> = {
  N: { dx: 0, dz: -1 },
  E: { dx: 1, dz: 0 },
  S: { dx: 0, dz: 1 },
  W: { dx: -1, dz: 0 }
};
const OPPOSITE_EDGE: Record<Edge, Edge> = {
  N: 'S',
  E: 'W',
  S: 'N',
  W: 'E'
};

export function validateTrackMap(trackMap: string | null | undefined): TrackMapValidationResult {
  if (!trackMap || typeof trackMap !== 'string') {
    return fail(['TRACK_MAP_INVALID']);
  }

  try {
    return validateTrackCells(decodeTrackCells(trackMap));
  } catch {
    return fail(['TRACK_MAP_INVALID']);
  }
}

export function validateTrackCells(rawCells: readonly (readonly unknown[])[]): TrackMapValidationResult {
  const errors = new Set<TrackMapErrorCode>();
  const cells: ValidatedTrackCell[] = [];
  const occupied = new Set<string>();
  let finishCount = 0;

  if (rawCells.length < TRACK_MAP_MIN_CELLS) errors.add('TRACK_MAP_TOO_SMALL');
  if (rawCells.length > TRACK_MAP_MAX_CELLS) errors.add('TRACK_MAP_TOO_LARGE');

  rawCells.forEach((rawCell) => {
    const [gx, gz, type, orient] = rawCell;

    if (
      typeof gx !== 'number' ||
      typeof gz !== 'number' ||
      !Number.isInteger(gx) ||
      !Number.isInteger(gz) ||
      gx < TRACK_MAP_MIN_COORD ||
      gx > TRACK_MAP_MAX_COORD ||
      gz < TRACK_MAP_MIN_COORD ||
      gz > TRACK_MAP_MAX_COORD
    ) {
      errors.add('TRACK_MAP_COORDS_OUT_OF_RANGE');
      return;
    }

    if (!isTrackTileType(type) || !isTrackOrientation(orient)) {
      errors.add('TRACK_MAP_UNSUPPORTED_TILE');
      return;
    }

    const key = cellKey(gx, gz);
    if (occupied.has(key)) {
      errors.add('TRACK_MAP_DUPLICATE_CELL');
      return;
    }

    occupied.add(key);
    if (type === 'track-finish') finishCount += 1;
    cells.push({ gx, gz, type, orient });
  });

  if (finishCount === 0) errors.add('TRACK_MAP_FINISH_MISSING');
  if (finishCount > 1) errors.add('TRACK_MAP_FINISH_DUPLICATE');

  if (errors.size === 0) {
    validateLoop(cells, errors);
  }

  if (errors.size > 0) {
    return fail([...errors]);
  }

  const finishCell = cells.find((cell) => cell.type === 'track-finish') as ValidatedTrackCell;
  const normalizedCells = cells.map((cell) => [cell.gx, cell.gz, cell.type, cell.orient] as const);

  return {
    ok: true,
    normalizedTrackMap: encodeTrackCells(normalizedCells),
    cells,
    cellCount: cells.length,
    bounds: computeTrackBounds(cells),
    finishCell,
    spawn: computeSpawn(finishCell),
    errors: []
  };
}

export function encodeTrackCells(cells: readonly TrackCellTuple[]): string {
  const bytes = new Uint8Array(cells.length * 3);

  cells.forEach(([gx, gz, type, orient], index) => {
    bytes[index * 3] = gx + 128;
    bytes[index * 3 + 1] = gz + 128;
    bytes[index * 3 + 2] = (TYPE_INDEX[type] << 2) | ORIENT_TO_INDEX[orient];
  });

  return bytesToBase64url(bytes);
}

export function decodeTrackCells(trackMap: string): TrackCellTuple[] {
  const bytes = base64urlToBytes(trackMap);
  if (bytes.length === 0 || bytes.length % 3 !== 0) {
    throw new Error('TRACK_MAP_INVALID');
  }

  const cells: TrackCellTuple[] = [];
  for (let index = 0; index + 2 < bytes.length; index += 3) {
    const gx = bytes[index] - 128;
    const gz = bytes[index + 1] - 128;
    const packed = bytes[index + 2];
    const type = INDEX_TYPE[(packed >> 2) & 0x03];
    const orient = INDEX_TO_ORIENT[packed & 0x03];
    cells.push([gx, gz, type, orient]);
  }

  return cells;
}

function validateLoop(cells: ValidatedTrackCell[], errors: Set<TrackMapErrorCode>): void {
  const byKey = new Map(cells.map((cell) => [cellKey(cell.gx, cell.gz), cell]));

  for (const cell of cells) {
    const connections = getCellConnections(cell);
    const connectedEdges = connections.filter((edge) => {
      const neighbor = byKey.get(neighborKey(cell, edge));
      return neighbor ? getCellConnections(neighbor).includes(OPPOSITE_EDGE[edge]) : false;
    });

    if (connectedEdges.length !== 2) {
      errors.add('TRACK_MAP_NOT_CLOSED_LOOP');
      return;
    }
  }

  const visited = new Set<string>();
  const stack = [cells[0]];
  while (stack.length > 0) {
    const current = stack.pop() as ValidatedTrackCell;
    const key = cellKey(current.gx, current.gz);
    if (visited.has(key)) continue;
    visited.add(key);

    getCellConnections(current).forEach((edge) => {
      const neighbor = byKey.get(neighborKey(current, edge));
      if (neighbor && getCellConnections(neighbor).includes(OPPOSITE_EDGE[edge])) {
        stack.push(neighbor);
      }
    });
  }

  if (visited.size !== cells.length) {
    errors.add('TRACK_MAP_NOT_CONNECTED');
  }
}

function getCellConnections(cell: Pick<ValidatedTrackCell, 'type' | 'orient'>): Edge[] {
  const turns = ORIENT_TO_TURNS[cell.orient];
  return BASE_CONNECTIONS[cell.type].map((edge) => rotateEdge(edge, turns));
}

function rotateEdge(edge: Edge, turns: number): Edge {
  const order: Edge[] = ['N', 'W', 'S', 'E'];
  const currentIndex = order.indexOf(edge);
  return order[(currentIndex + turns) % order.length];
}

function computeTrackBounds(cells: ValidatedTrackCell[]): TrackMapBounds {
  const minX = Math.min(...cells.map((cell) => cell.gx));
  const maxX = Math.max(...cells.map((cell) => cell.gx));
  const minZ = Math.min(...cells.map((cell) => cell.gz));
  const maxZ = Math.max(...cells.map((cell) => cell.gz));
  const scale = CELL_RAW * GRID_SCALE;

  return {
    minX,
    maxX,
    minZ,
    maxZ,
    centerX: ((minX + maxX + 1) / 2) * scale,
    centerZ: ((minZ + maxZ + 1) / 2) * scale,
    halfWidth: ((maxX - minX + 1) / 2) * scale + scale,
    halfDepth: ((maxZ - minZ + 1) / 2) * scale + scale
  };
}

function computeSpawn(cell: ValidatedTrackCell): TrackSpawn {
  const scale = CELL_RAW * GRID_SCALE;
  return {
    position: [(cell.gx + 0.5) * scale, 0.5, (cell.gz + 0.5) * scale],
    angle: (ORIENT_DEG[cell.orient] * Math.PI) / 180
  };
}

function fail(errors: TrackMapErrorCode[]): TrackMapValidationResult {
  return { ok: false, errors };
}

function isTrackTileType(value: unknown): value is TrackTileType {
  return typeof value === 'string' && (TRACK_TILE_TYPES as readonly string[]).includes(value);
}

function isTrackOrientation(value: unknown): value is TrackOrientation {
  return typeof value === 'number' && (TRACK_ORIENTATIONS as readonly number[]).includes(value);
}

function neighborKey(cell: Pick<ValidatedTrackCell, 'gx' | 'gz'>, edge: Edge): string {
  const vector = EDGE_VECTORS[edge];
  return cellKey(cell.gx + vector.dx, cell.gz + vector.dz);
}

function cellKey(gx: number, gz: number): string {
  return `${gx},${gz}`;
}

function bytesToBase64url(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}
