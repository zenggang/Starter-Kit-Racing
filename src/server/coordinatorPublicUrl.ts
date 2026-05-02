import type { TransportMode } from '@/realtime/protocol';

/**
 * Selects one transport mode on the server so the browser never has to guess
 * whether the current deployment should use direct socket ingress or the
 * validated same-origin bridge path.
 */
export function chooseCoordinatorMode(coordinatorUrl: string, bridgeEnabled: boolean): TransportMode | null {
  const host = safeHost(coordinatorUrl);

  /**
   * Prefer WebSocket whenever the coordinator URL is syntactically valid,
   * including the default `workers.dev` hostname. The browser hooks already
   * contain a bridge fallback path, so choosing socket first is the only way to
   * avoid turning every race tick into a billed HTTP request.
   */
  if (host) return 'socket';
  if (bridgeEnabled) return null;

  return null;
}

function safeHost(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}
