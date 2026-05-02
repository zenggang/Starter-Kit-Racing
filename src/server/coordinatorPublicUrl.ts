import type { TransportMode } from '@/realtime/protocol';

/**
 * Selects one transport mode on the server so the browser never has to guess
 * whether the current deployment should use direct socket ingress or the
 * validated same-origin bridge path.
 */
export function chooseCoordinatorMode(coordinatorUrl: string, bridgeEnabled: boolean): TransportMode | null {
  const host = safeHost(coordinatorUrl);

  if (bridgeEnabled) return 'bridge';
  if (!host) return null;
  if (host.endsWith('.workers.dev')) return null;

  return 'socket';
}

function safeHost(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}
