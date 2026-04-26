import type { TransportMode } from '@/realtime/protocol';

/**
 * Selects one transport mode on the server so the browser does not guess between
 * direct Workers socket access and the same-origin bridge fallback.
 */
export function chooseCoordinatorMode(coordinatorUrl: string, bridgeEnabled: boolean): TransportMode | null {
  const host = safeHost(coordinatorUrl);

  if (!host) return bridgeEnabled ? 'bridge' : null;
  if (host.endsWith('.workers.dev')) return bridgeEnabled ? 'bridge' : null;

  return 'socket';
}

function safeHost(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}
