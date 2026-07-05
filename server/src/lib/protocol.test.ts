import { describe, expect, it } from 'vitest';
import { isTrackScene, isVehicleModel, isVehicleType, normalizeTrackScene, normalizeVehicleSelection } from './protocol.js';

describe('server protocol vehicle types', () => {
  it('keeps legacy truck and accepts car category with model selection', () => {
    expect(isVehicleType('truck')).toBe(true);
    expect(isVehicleType('car')).toBe(true);
    expect(isVehicleType('motorcycle')).toBe(true);
    expect(isVehicleType('dog')).toBe(true);
    expect(isVehicleType('sedan')).toBe(false);
    expect(isVehicleType('kart')).toBe(false);
    expect(isVehicleModel('mercedes-e')).toBe(true);
  });

  it('normalizes legacy sedan payloads to the car category and default model', () => {
    expect(normalizeVehicleSelection({ vehicleType: 'sedan' })).toEqual({
      ok: true,
      vehicleType: 'car',
      vehicleModel: 'mercedes-e'
    });
  });

  it('normalizes supported track scenes and rejects unknown scenes', () => {
    expect(isTrackScene('forest')).toBe(true);
    expect(isTrackScene('city')).toBe(true);
    expect(isTrackScene('desert')).toBe(false);

    expect(normalizeTrackScene(undefined)).toEqual({ ok: true, trackScene: 'forest' });
    expect(normalizeTrackScene('city')).toEqual({ ok: true, trackScene: 'city' });
    expect(normalizeTrackScene('desert')).toEqual({ ok: false, errorCode: 'TRACK_SCENE_INVALID' });
  });
});
