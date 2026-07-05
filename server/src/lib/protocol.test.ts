import { describe, expect, it } from 'vitest';
import { isVehicleType } from './protocol.js';

describe('server protocol vehicle types', () => {
  it('keeps legacy truck and accepts the new sedan option', () => {
    expect(isVehicleType('truck')).toBe(true);
    expect(isVehicleType('sedan')).toBe(true);
    expect(isVehicleType('motorcycle')).toBe(true);
    expect(isVehicleType('dog')).toBe(true);
    expect(isVehicleType('kart')).toBe(false);
  });
});
