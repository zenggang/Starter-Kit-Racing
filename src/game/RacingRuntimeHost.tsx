'use client';

import { useEffect, useRef, useState } from 'react';

interface RacingRuntimeHandle {
  destroy(): void;
}

interface RacingRuntimeModule {
  mountRacingRuntime(container: HTMLElement, options?: Record<string, unknown>): Promise<RacingRuntimeHandle>;
}

/**
 * Mounts the legacy Three.js racing runtime inside the Next.js race route. The
 * container owns the full mobile viewport so touch steering is not intercepted
 * by document scrolling or browser chrome changes.
 */
export function RacingRuntimeHost({ roomCode }: { roomCode: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let runtime: RacingRuntimeHandle | null = null;
    let cancelled = false;

    async function mount() {
      if (!containerRef.current) return;

      try {
        const mod = (await import('../../js/main.js')) as RacingRuntimeModule;
        runtime = await mod.mountRacingRuntime(containerRef.current, {
          assetBaseUrl: '/racing/',
          roomCode
        });

        if (cancelled) {
          runtime.destroy();
          runtime = null;
        }
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : 'RUNTIME_MOUNT_FAILED');
      }
    }

    void mount();

    return () => {
      cancelled = true;
      runtime?.destroy();
    };
  }, [roomCode]);

  return (
    <main className="racing-runtime" ref={containerRef}>
      {error ? <p className="error">{error}</p> : null}
    </main>
  );
}
