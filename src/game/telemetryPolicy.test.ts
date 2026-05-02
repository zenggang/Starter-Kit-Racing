import { describe, expect, it } from 'vitest';
import { getRaceTelemetryIntervalMs } from './telemetryPolicy';

describe('race telemetry policy', () => {
  it('uses a tighter cadence for socket transport and a slower cadence for bridge fallback', () => {
    expect(getRaceTelemetryIntervalMs('socket')).toBe(500);
    expect(getRaceTelemetryIntervalMs('bridge')).toBe(1500);
  });

  it('defaults to the socket cadence before transport selection settles', () => {
    expect(getRaceTelemetryIntervalMs(null)).toBe(500);
  });
});
