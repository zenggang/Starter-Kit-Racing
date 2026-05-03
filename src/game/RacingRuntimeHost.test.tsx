import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RacingRuntimeHost } from './RacingRuntimeHost';

const updateRemoteVehiclesSpy = vi.fn();

vi.stubGlobal('React', React);

vi.mock('../../js/main.js', () => ({
  mountRacingRuntime: vi.fn().mockResolvedValue({
    destroy: vi.fn(),
    getSnapshot: vi.fn(() => ({
      position: { x: 0, y: 0, z: 0 },
      heading: 0,
      speed: 0,
      driftIntensity: 0
    })),
    updateRemoteVehicles: updateRemoteVehiclesSpy
  })
}));

describe('RacingRuntimeHost remote vehicles', () => {
  it('pushes remote vehicle telemetry into the mounted runtime handle', async () => {
    const Host = RacingRuntimeHost as React.ComponentType<Record<string, unknown>>;

    render(
      <Host
        roomCode="8966"
        trackMap={null}
        vehicleColor="yellow"
        remoteVehicles={[
          {
            playerId: 'player-2',
            nickname: '远端绿车',
            color: 'green',
            presence: 'connected',
            position: { x: 3, y: 0.5, z: 4 },
            heading: 0.5,
            speed: 12,
            lastReportAt: '2026-05-03T10:01:02.000Z'
          }
        ]}
      />
    );

    await waitFor(() => {
      expect(updateRemoteVehiclesSpy).toHaveBeenCalledWith([
        {
          playerId: 'player-2',
          nickname: '远端绿车',
          color: 'green',
          presence: 'connected',
          position: { x: 3, y: 0.5, z: 4 },
          heading: 0.5,
          speed: 12,
          lastReportAt: '2026-05-03T10:01:02.000Z'
        }
      ]);
    });
  });
});
