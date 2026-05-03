import { describe, expect, it } from 'vitest';
import { encodeTrackCells, validateTrackCells, validateTrackMap } from './trackMapValidation';

const VALID_LOOP = [
  [0, 0, 'track-corner', 16],
  [1, 0, 'track-finish', 16],
  [2, 0, 'track-corner', 0],
  [2, 1, 'track-straight', 0],
  [2, 2, 'track-corner', 22],
  [1, 2, 'track-straight', 16],
  [0, 2, 'track-corner', 10],
  [0, 1, 'track-straight', 0]
] as const;

describe('track map validation', () => {
  it('accepts a closed loop with exactly one finish tile', () => {
    const encoded = encodeTrackCells(VALID_LOOP);
    const result = validateTrackMap(encoded);

    expect(result.ok).toBe(true);
    expect(result.ok ? result.cellCount : 0).toBe(8);
    expect(result.ok ? result.normalizedTrackMap : '').toBe(encoded);
    expect(result.ok ? result.finishCell : null).toMatchObject({ gx: 1, gz: 0, type: 'track-finish' });
    expect(result.ok ? Number.isFinite(result.spawn.position[0]) : false).toBe(true);
  });

  it('rejects maps without a finish tile', () => {
    const result = validateTrackCells(VALID_LOOP.map((cell) => (cell[2] === 'track-finish' ? [cell[0], cell[1], 'track-straight', cell[3]] : cell)));

    expect(result).toMatchObject({
      ok: false,
      errors: expect.arrayContaining(['TRACK_MAP_FINISH_MISSING'])
    });
  });

  it('rejects disconnected or open track layouts', () => {
    const result = validateTrackCells(VALID_LOOP.map((cell) => (cell[0] === 0 && cell[1] === 1 ? [cell[0], cell[1], cell[2], 16] : cell)));

    expect(result).toMatchObject({
      ok: false,
      errors: expect.arrayContaining(['TRACK_MAP_NOT_CLOSED_LOOP'])
    });
  });

  it('rejects duplicate cell coordinates before saving', () => {
    const result = validateTrackCells([...VALID_LOOP, [0, 0, 'track-straight', 0]]);

    expect(result).toMatchObject({
      ok: false,
      errors: expect.arrayContaining(['TRACK_MAP_DUPLICATE_CELL'])
    });
  });

  it('rejects tracks above the 192 cell first-stage limit', () => {
    const oversized = Array.from({ length: 193 }, (_, index) => [index, 0, index === 0 ? 'track-finish' : 'track-straight', 16] as const);
    const result = validateTrackCells(oversized);

    expect(result).toMatchObject({
      ok: false,
      errors: expect.arrayContaining(['TRACK_MAP_TOO_LARGE'])
    });
  });
});
