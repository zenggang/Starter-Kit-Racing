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

export interface RuntimeHandle {
  destroy(): void;
  getSnapshot(): RuntimeSnapshot;
}

interface RuntimeMountOptions {
  assetBaseUrl?: string;
  roomCode?: string;
  trackMap?: string | null;
  vehicleColor?: 'yellow' | 'green' | 'purple' | 'red';
}

/**
 * Hosts the legacy canvas runtime inside the App Router shell while keeping the
 * runtime itself isolated from React state and coordinator transport details.
 */
export function RacingRuntimeHost({
  roomCode,
  trackMap,
  vehicleColor,
  onRuntimeReady,
  children
}: {
  roomCode: string;
  trackMap: string | null;
  vehicleColor: RuntimeMountOptions['vehicleColor'];
  onRuntimeReady?: (runtime: RuntimeHandle | null) => void;
  children?: React.ReactNode;
}) {
  const containerRef = useRef<HTMLElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let runtime: RuntimeHandle | null = null;
    let cancelled = false;

    async function mount() {
      if (!containerRef.current) return;

      try {
        const mod = (await import('../../js/main.js')) as RacingRuntimeModule;
        runtime = await mod.mountRacingRuntime(containerRef.current, {
          assetBaseUrl: '/racing/',
          roomCode,
          trackMap,
          vehicleColor
        });

        if (cancelled) {
          runtime.destroy();
          runtime = null;
          return;
        }

        onRuntimeReady?.(runtime);
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : 'RUNTIME_MOUNT_FAILED');
      }
    }

    void mount();

    return () => {
      cancelled = true;
      onRuntimeReady?.(null);
      runtime?.destroy();
    };
  }, [onRuntimeReady, roomCode, trackMap, vehicleColor]);

  return (
    <main className="racing-runtime" ref={containerRef}>
      {children}
      {error ? <p className="race-overlay error-banner runtime-error">{error}</p> : null}
    </main>
  );
}
