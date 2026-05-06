import { describe, expect, it } from 'vitest';
import { createCommandResult, isPlayerColor, isVehicleType, validateLapTarget, validateMatchProgressPayload } from './protocol';

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

  it('allows only supported vehicle body types', () => {
    expect(isVehicleType('truck')).toBe(true);
    expect(isVehicleType('motorcycle')).toBe(true);
    expect(isVehicleType('dog')).toBe(true);
    expect(isVehicleType('kart')).toBe(false);
    expect(isVehicleType(null)).toBe(false);
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

  it('accepts coordinator telemetry payloads with bounded lap progress', () => {
    expect(
      validateMatchProgressPayload({
        checkpoint: 2,
        completedLaps: 1,
        lapProgress: 0.45,
        position: { x: 1, y: 0.5, z: 2 },
        heading: 0,
        speed: 1.2,
        finished: false
      })
    ).toBe(true);
    expect(validateMatchProgressPayload({ checkpoint: 0, completedLaps: -1, lapProgress: 3, position: null, heading: 0, speed: 0 })).toBe(false);
  });
});
