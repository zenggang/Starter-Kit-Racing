import React from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RacingRuntimeHost } from './RacingRuntimeHost';

const mountRacingRuntimeSpy = vi.fn();
const updateRemoteVehiclesSpy = vi.fn();
const destroySpy = vi.fn();

vi.stubGlobal('React', React);

vi.mock('../../js/main.js', () => ({
  mountRacingRuntime: mountRacingRuntimeSpy
}));

describe('RacingRuntimeHost remote vehicles', () => {
  beforeEach(() => {
    mountRacingRuntimeSpy.mockReset();
    updateRemoteVehiclesSpy.mockReset();
    destroySpy.mockReset();
    mountRacingRuntimeSpy.mockResolvedValue({
      destroy: destroySpy,
      getSnapshot: vi.fn(() => ({
        position: { x: 0, y: 0, z: 0 },
        heading: 0,
        speed: 0,
        driftIntensity: 0
      })),
      updateRemoteVehicles: updateRemoteVehiclesSpy
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

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

  it('aborts cancelled mounts and ignores their late failures after track swaps', async () => {
    const firstMount = Promise.reject(new Error('STALE_RUNTIME_FAILED'));
    const secondRuntime = {
      destroy: destroySpy,
      getSnapshot: vi.fn(() => ({
        position: { x: 0, y: 0, z: 0 },
        heading: 0,
        speed: 0,
        driftIntensity: 0
      })),
      updateRemoteVehicles: updateRemoteVehiclesSpy
    };
    const secondMount = Promise.resolve(secondRuntime);

    mountRacingRuntimeSpy
      .mockReturnValueOnce(firstMount)
      .mockReturnValueOnce(secondMount);

    const Host = RacingRuntimeHost as React.ComponentType<Record<string, unknown>>;
    const { container, rerender } = render(<Host roomCode="8966" trackMap={null} vehicleColor="yellow" />);

    await waitFor(() => {
      expect(mountRacingRuntimeSpy).toHaveBeenCalledTimes(1);
    });

    const firstCallOptions = mountRacingRuntimeSpy.mock.calls[0]?.[1] as { abortSignal?: AbortSignal } | undefined;
    expect(firstCallOptions?.abortSignal?.aborted).toBe(false);

    rerender(<Host roomCode="8966" trackMap="custom-track-map" vehicleColor="yellow" />);

    expect(firstCallOptions?.abortSignal?.aborted).toBe(true);

    await act(async () => {
      try {
        await firstMount;
      } catch {
        // The host should ignore the cancelled mount rejection.
      }

      await secondMount;
    });

    await waitFor(() => {
      expect(container.querySelector('.runtime-error')).toBeNull();
    });

    expect(mountRacingRuntimeSpy).toHaveBeenCalledTimes(2);
  });
});
