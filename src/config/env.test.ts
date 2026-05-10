import { describe, expect, it, vi } from 'vitest';
import { buildPublicApiUrl, getPublicRuntimeConfig, getPublicRuntimeMode, getSelfHostedServerBaseUrl } from './env';

describe('runtime env', () => {
  it('uses demo mode when Colyseus public env is missing', () => {
    expect(getPublicRuntimeMode({})).toBe('demo');
    expect(getPublicRuntimeMode({ NEXT_PUBLIC_API_BASE_URL: '/api' })).toBe('demo');
  });

  it('uses online mode when Colyseus public env is present', () => {
    expect(
      getPublicRuntimeMode({
        NEXT_PUBLIC_COLYSEUS_URL: 'wss://8.148.79.214/colyseus'
      })
    ).toBe('online');
  });

  it('reads public self-hosted runtime config', () => {
    expect(
      getPublicRuntimeConfig({
        NEXT_PUBLIC_COLYSEUS_URL: 'wss://8.148.79.214/colyseus',
        NEXT_PUBLIC_API_BASE_URL: '/api'
      })
    ).toEqual({
      colyseusUrl: 'wss://8.148.79.214/colyseus',
      apiBaseUrl: '/api'
    });
  });

  it('builds browser API urls from the configured public base', () => {
    expect(buildPublicApiUrl('/rooms', { NEXT_PUBLIC_API_BASE_URL: '/api' })).toBe('/api/rooms');
  });

  it('keeps browser API traffic same-origin even when a legacy public API env is baked into the bundle', async () => {
    const originalApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
    const originalColyseusUrl = process.env.NEXT_PUBLIC_COLYSEUS_URL;

    process.env.NEXT_PUBLIC_API_BASE_URL = 'https://8.148.79.214/api';
    process.env.NEXT_PUBLIC_COLYSEUS_URL = 'wss://8.148.79.214/colyseus';
    vi.resetModules();

    try {
      const runtimeModule = await import('./env');
      expect(runtimeModule.getPublicRuntimeConfig({}).apiBaseUrl).toBe('/api');
      expect(runtimeModule.buildPublicApiUrl('/rooms')).toBe('/api/rooms');
    } finally {
      if (originalApiBaseUrl === undefined) {
        delete process.env.NEXT_PUBLIC_API_BASE_URL;
      } else {
        process.env.NEXT_PUBLIC_API_BASE_URL = originalApiBaseUrl;
      }

      if (originalColyseusUrl === undefined) {
        delete process.env.NEXT_PUBLIC_COLYSEUS_URL;
      } else {
        process.env.NEXT_PUBLIC_COLYSEUS_URL = originalColyseusUrl;
      }

      vi.resetModules();
    }
  });

  it('uses localhost self-hosted server base url by default', () => {
    expect(getSelfHostedServerBaseUrl({})).toBe('http://127.0.0.1:2567');
  });
});
