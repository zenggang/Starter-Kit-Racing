import { describe, expect, it } from 'vitest';
import { getPublicRuntimeMode, getServerCoordinatorConfig } from './env';

describe('runtime env', () => {
  it('uses demo mode when Supabase public env is missing', () => {
    expect(getPublicRuntimeMode({})).toBe('demo');
    expect(getPublicRuntimeMode({ NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co' })).toBe('demo');
  });

  it('uses online mode when Supabase public env is complete', () => {
    expect(
      getPublicRuntimeMode({
        NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon'
      })
    ).toBe('online');
  });

  it('returns a machine-readable coordinator error when server env is incomplete', () => {
    expect(getServerCoordinatorConfig({})).toEqual({
      ok: false,
      errorCode: 'COORDINATOR_NOT_READY',
      missing: ['COORDINATOR_URL', 'COORDINATOR_SHARED_SECRET']
    });
  });

  it('reads server-only coordinator config without requiring bridge mode', () => {
    expect(
      getServerCoordinatorConfig({
        COORDINATOR_URL: 'https://coordinator.example.com',
        COORDINATOR_SHARED_SECRET: 'secret',
        COORDINATOR_BRIDGE_ENABLED: 'false'
      })
    ).toEqual({
      ok: true,
      url: 'https://coordinator.example.com',
      sharedSecret: 'secret',
      bridgeEnabled: false
    });
  });
});
