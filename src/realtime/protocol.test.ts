import { describe, expect, it } from 'vitest';
import { createCommandResult, isPlayerColor, validateLapTarget } from './protocol';

describe('Phase 1 realtime protocol', () => {
  it('accepts integer lap targets from 1 through 10', () => {
    expect(validateLapTarget(1)).toEqual({ ok: true, value: 1 });
    expect(validateLapTarget(10)).toEqual({ ok: true, value: 10 });
  });

  it('rejects invalid lap targets with LAP_TARGET_INVALID', () => {
    for (const value of [0, -1, 11, 1.5, '3', null]) {
      expect(validateLapTarget(value)).toEqual({ ok: false, errorCode: 'LAP_TARGET_INVALID' });
    }
  });

  it('allows only colors with existing vehicle assets', () => {
    expect(isPlayerColor('yellow')).toBe(true);
    expect(isPlayerColor('green')).toBe(true);
    expect(isPlayerColor('purple')).toBe(true);
    expect(isPlayerColor('red')).toBe(true);
    expect(isPlayerColor('blue')).toBe(false);
  });

  it('creates command.result envelopes without leaking transport details', () => {
    expect(createCommandResult(3, false, { errorCode: 'COLOR_TAKEN', commandId: 'cmd-1' })).toEqual({
      type: 'command.result',
      seq: 3,
      ok: false,
      errorCode: 'COLOR_TAKEN',
      commandId: 'cmd-1'
    });
  });
});
