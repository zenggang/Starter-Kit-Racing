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
 * Next.js client bundles do not reliably expose a populated `process.env`
 * object at runtime. Capturing the public env values at module evaluation time
 * allows Next's compiler to inline the configured values into browser chunks.
 */
const PUBLIC_COLYSEUS_URL = process.env.NEXT_PUBLIC_COLYSEUS_URL;
const PUBLIC_API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const SELF_HOSTED_SERVER_BASE_URL = process.env.SELF_HOSTED_SERVER_BASE_URL;

export function getPublicRuntimeMode(env: EnvSource = {}): PublicRuntimeMode {
  if (!(env.NEXT_PUBLIC_COLYSEUS_URL ?? PUBLIC_COLYSEUS_URL)) {
    return 'demo';
  }

  return 'online';
}

export function getPublicRuntimeConfig(env: EnvSource = {}): { colyseusUrl: string; apiBaseUrl: string } {
  return {
    /**
     * The new production baseline keeps the browser-facing frontend on Vercel
     * and talks to the ECS realtime backend over a trusted IP certificate.
     * Falling back to the ECS WSS IP keeps the runtime aligned with that
     * deployment shape even when no public env is injected yet.
     */
    colyseusUrl: env.NEXT_PUBLIC_COLYSEUS_URL ?? PUBLIC_COLYSEUS_URL ?? 'wss://8.148.79.214/colyseus',
    /**
     * Vercel's server-side proxy to the ECS IP proved unreliable in production.
     * The stable runtime path is to let the browser talk directly to the ECS
     * HTTPS API entry and keep this value configurable for local development.
     */
    apiBaseUrl: env.NEXT_PUBLIC_API_BASE_URL ?? PUBLIC_API_BASE_URL ?? 'https://8.148.79.214/api'
  };
}

export function getSelfHostedServerBaseUrl(env: EnvSource = {}): string {
  /**
   * Local development continues to proxy to a backend running on the same
   * machine. Production Vercel deployments override this with the ECS HTTPS IP.
   */
  return env.SELF_HOSTED_SERVER_BASE_URL ?? SELF_HOSTED_SERVER_BASE_URL ?? 'http://127.0.0.1:2567';
}

/**
 * Normalizes browser-visible API paths so client components can target either
 * same-origin routes in local development or the ECS HTTPS IP in production
 * without duplicating string concatenation logic throughout the app shell.
 */
export function buildPublicApiUrl(path: string, env: EnvSource = {}): string {
  const { apiBaseUrl } = getPublicRuntimeConfig(env);
  const base = apiBaseUrl.replace(/\/$/, '');
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${base}${suffix}`;
}

export function getServerCoordinatorConfig(_env: EnvSource = process.env): CoordinatorConfig {
  return {
    ok: false,
    errorCode: 'COORDINATOR_NOT_READY',
    missing: ['COORDINATOR_URL', 'COORDINATOR_SHARED_SECRET']
  };
}
