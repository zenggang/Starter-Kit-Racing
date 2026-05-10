import { describe, expect, it } from 'vitest';
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

  it('uses localhost self-hosted server base url by default', () => {
    expect(getSelfHostedServerBaseUrl({})).toBe('http://127.0.0.1:2567');
  });
});
