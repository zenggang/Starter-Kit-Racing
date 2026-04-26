import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';
import { signCoordinatorTicket } from '@/server/coordinatorTicket';

describe('/api/coordinator-bridge/room/[code]', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('rejects missing or invalid tickets', async () => {
    vi.stubEnv('COORDINATOR_URL', 'https://racing.example.com');
    vi.stubEnv('COORDINATOR_SHARED_SECRET', 'server-secret');

    const response = await POST(new Request('http://localhost/api/coordinator-bridge/room/ABCD', { method: 'POST', body: '{}' }), {
      params: Promise.resolve({ code: 'ABCD' })
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ ok: false, errorCode: 'AUTH_TICKET_INVALID' });
  });

  it('forwards command payloads to the coordinator', async () => {
    vi.stubEnv('COORDINATOR_URL', 'https://racing.example.com');
    vi.stubEnv('COORDINATOR_SHARED_SECRET', 'server-secret');
    const token = signCoordinatorTicket({ playerId: 'player-1', nickname: 'Racer', roomCode: 'ABCD', issuedAt: Date.now(), expiresAt: Date.now() + 1000 }, 'server-secret');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ type: 'command.result', seq: 1, ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    );

    const response = await POST(
      new Request('http://localhost/api/coordinator-bridge/room/abcd', {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
        body: JSON.stringify({ type: 'room.join' })
      }),
      { params: Promise.resolve({ code: 'abcd' }) }
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://racing.example.com/rooms/ABCD/commands',
      expect.objectContaining({
        method: 'POST'
      })
    );
    expect(JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)).toMatchObject({
      type: 'room.join',
      playerId: 'player-1',
      authTicket: { playerId: 'player-1' },
      payload: { nickname: 'Racer' }
    });
  });

  it('forwards room.create to the coordinator room creation endpoint', async () => {
    vi.stubEnv('COORDINATOR_URL', 'https://racing.example.com');
    vi.stubEnv('COORDINATOR_SHARED_SECRET', 'server-secret');
    const token = signCoordinatorTicket({ playerId: 'player-1', nickname: 'Racer', issuedAt: Date.now(), expiresAt: Date.now() + 1000 }, 'server-secret');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ type: 'command.result', seq: 1, ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    );

    await POST(
      new Request('http://localhost/api/coordinator-bridge/room/new', {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
        body: JSON.stringify({ type: 'room.create' })
      }),
      { params: Promise.resolve({ code: 'new' }) }
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'https://racing.example.com/rooms',
      expect.objectContaining({
        method: 'POST'
      })
    );
    expect(JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)).toMatchObject({
      type: 'room.create',
      playerId: 'player-1',
      authTicket: { playerId: 'player-1' },
      payload: { nickname: 'Racer' }
    });
  });
});
