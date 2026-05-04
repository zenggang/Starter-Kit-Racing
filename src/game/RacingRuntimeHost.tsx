'use client';

import { useEffect, useRef, useState } from 'react';

interface RacingRuntimeModule {
  mountRacingRuntime(container: HTMLElement, options?: RuntimeMountOptions): Promise<RuntimeHandle>;
}

export interface RuntimeSnapshot {
  position: {
    x: number;
    y: number;
    z: number;
  };
  heading: number;
  speed: number;
  driftIntensity: number;
}

export interface RemoteVehicleTelemetry {
  playerId: string;
  nickname: string;
  color: NonNullable<RuntimeMountOptions['vehicleColor']>;
  presence: 'pending' | 'connected' | 'disconnected' | 'finished';
  position: {
    x: number;
    y: number;
    z: number;
  };
  heading: number;
  speed: number;
  lastReportAt: string | null;
}

export interface RuntimeHandle {
  destroy(): void;
  getSnapshot(): RuntimeSnapshot;
  updateRemoteVehicles(vehicles: RemoteVehicleTelemetry[]): void;
  setInputLocked(locked: boolean): void;
}

interface RuntimeMountOptions {
  assetBaseUrl?: string;
  roomCode?: string;
  trackMap?: string | null;
  vehicleColor?: 'yellow' | 'green' | 'purple' | 'red';
  inputLocked?: boolean;
  abortSignal?: AbortSignal;
}

/**
 * Hosts the legacy canvas runtime inside the App Router shell while keeping the
 * runtime itself isolated from React state and coordinator transport details.
 */
export function RacingRuntimeHost({
  roomCode,
  trackMap,
  vehicleColor,
  inputLocked = false,
  remoteVehicles,
  onRuntimeReady,
  children
}: {
  roomCode: string;
  trackMap: string | null;
  vehicleColor: RuntimeMountOptions['vehicleColor'];
  inputLocked?: boolean;
  remoteVehicles?: RemoteVehicleTelemetry[];
  onRuntimeReady?: (runtime: RuntimeHandle | null) => void;
  children?: React.ReactNode;
}) {
  const containerRef = useRef<HTMLElement | null>(null);
  const runtimeRef = useRef<RuntimeHandle | null>(null);
  const inputLockedRef = useRef(inputLocked);
  const remoteVehiclesRef = useRef<RemoteVehicleTelemetry[]>(remoteVehicles ?? []);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let runtime: RuntimeHandle | null = null;
    let cancelled = false;
    const abortController = new AbortController();

    setError(null);

    async function mount() {
      if (!containerRef.current) return;

      try {
        const mod = (await import('../../js/main.js')) as RacingRuntimeModule;
        runtime = await mod.mountRacingRuntime(containerRef.current, {
          assetBaseUrl: '/racing/',
          roomCode,
          trackMap,
          vehicleColor,
          abortSignal: abortController.signal
        });

        if (cancelled) {
          runtime.destroy();
          runtime = null;
          return;
        }

        runtimeRef.current = runtime;
        runtime.updateRemoteVehicles(remoteVehiclesRef.current);
        runtime.setInputLocked(inputLockedRef.current);
        onRuntimeReady?.(runtime);
      } catch (nextError) {
        if (!cancelled) {
          setError(nextError instanceof Error ? nextError.message : 'RUNTIME_MOUNT_FAILED');
        }
      }
    }

    void mount();

    return () => {
      cancelled = true;
      abortController.abort();
      onRuntimeReady?.(null);
      runtimeRef.current = null;
      runtime?.destroy();
    };
  }, [onRuntimeReady, roomCode, trackMap, vehicleColor]);

  useEffect(() => {
    remoteVehiclesRef.current = remoteVehicles ?? [];
    runtimeRef.current?.updateRemoteVehicles(remoteVehiclesRef.current);
  }, [remoteVehicles]);

  useEffect(() => {
    inputLockedRef.current = inputLocked;
    runtimeRef.current?.setInputLocked(inputLocked);
  }, [inputLocked]);

  return (
    <main className="racing-runtime" ref={containerRef}>
      {children}
      {error ? <p className="race-overlay error-banner runtime-error">{error}</p> : null}
    </main>
  );
}
