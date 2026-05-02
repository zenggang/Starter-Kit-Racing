import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

describe('/api/coordinator-ticket', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns COORDINATOR_NOT_READY when coordinator env is missing', async () => {
    const response = await POST(new Request('http://localhost/api/coordinator-ticket', { method: 'POST', body: '{}' }));
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.errorCode).toBe('COORDINATOR_NOT_READY');
  });

  it('returns one transport mode and does not expose the shared secret', async () => {
    vi.stubEnv('COORDINATOR_URL', 'https://racing.example.com');
    vi.stubEnv('COORDINATOR_SHARED_SECRET', 'server-secret');
    vi.stubEnv('COORDINATOR_BRIDGE_ENABLED', 'true');

    const response = await POST(
      new Request('http://localhost/api/coordinator-ticket', {
        method: 'POST',
        body: JSON.stringify({ playerId: 'player-1', nickname: 'Racer', roomCode: 'ABCD' })
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.mode).toBe('bridge');
    expect(JSON.stringify(body)).not.toContain('server-secret');
  });
});
