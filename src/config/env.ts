export type PublicRuntimeMode = 'demo' | 'online';

export type CoordinatorConfig =
  | {
      ok: true;
      url: string;
      sharedSecret: string;
      bridgeEnabled: boolean;
    }
  | {
      ok: false;
      errorCode: 'COORDINATOR_NOT_READY';
      missing: string[];
    };

type EnvSource = Record<string, string | undefined>;

/**
 * Determines whether the browser should enter local demo mode or the online shell.
 * Supabase public variables are the Phase 1 feature gate because they are required
 * before the client can list durable rooms or request coordinator tickets.
 */
export function getPublicRuntimeMode(env: EnvSource = process.env): PublicRuntimeMode {
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return 'demo';
  }

  return 'online';
}

/**
 * Reads server-only coordinator settings for ticket signing and bridge forwarding.
 * The shared secret is intentionally returned only from server-side code paths and
 * must never be serialized into a client response.
 */
export function getServerCoordinatorConfig(env: EnvSource = process.env): CoordinatorConfig {
  const missing: string[] = [];

  if (!env.COORDINATOR_URL) missing.push('COORDINATOR_URL');
  if (!env.COORDINATOR_SHARED_SECRET) missing.push('COORDINATOR_SHARED_SECRET');

  if (missing.length > 0) {
    return {
      ok: false,
      errorCode: 'COORDINATOR_NOT_READY',
      missing
    };
  }

  return {
    ok: true,
    url: env.COORDINATOR_URL as string,
    sharedSecret: env.COORDINATOR_SHARED_SECRET as string,
    bridgeEnabled: env.COORDINATOR_BRIDGE_ENABLED !== 'false'
  };
}
