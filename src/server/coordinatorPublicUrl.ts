import type { TransportMode } from '@/realtime/protocol';

/**
 * Selects one transport mode on the server so the browser never has to guess
 * whether the current deployment should use direct socket ingress or the
 * validated same-origin bridge path.
 */
export function chooseCoordinatorMode(coordinatorUrl: string, bridgeEnabled: boolean): TransportMode | null {
  const host = safeHost(coordinatorUrl);

  if (host && !host.endsWith('.workers.dev')) return 'socket';
  if (bridgeEnabled) return 'bridge';

  return null;
}

function safeHost(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}
