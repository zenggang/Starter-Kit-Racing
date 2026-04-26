import { describe, expect, it } from 'vitest';
import { RoomCoordinator } from '../src/RoomCoordinator';
import { InMemoryRoomStorage } from '../src/storage';
import type { AuthTicket, RoomCommandEnvelope } from '../src/protocol';

const START = Date.parse('2026-04-26T00:00:00.000Z');

function ticket(playerId: string, now = START): AuthTicket {
  return {
    playerId,
    issuedAt: now - 1_000,
    expiresAt: now + 3_600_000
  };
}

function command<TPayload>(
  type: RoomCommandEnvelope<TPayload>['type'],
  playerId: string,
  payload: TPayload,
  commandId = `${type}:${playerId}`,
  now = START
): RoomCommandEnvelope<TPayload> {
  return {
    commandId,
    type,
    playerId,
    authTicket: ticket(playerId, now),
    payload
  };
}

function createCoordinator() {
  return new RoomCoordinator(new InMemoryRoomStorage(), {
    now: () => START,
    roomCodeGenerator: () => 'ABCD12'
  });
}

describe('RoomCoordinator Phase 1 lifecycle', () => {
  it('creates a waiting room with host player and 60 minute expiration', async () => {
    const coordinator = createCoordinator();

    const result = await coordinator.execute(command('room.create', 'host-1', { nickname: 'Host' }));

    expect(result.ok).toBe(true);
    expect(result.room?.code).toBe('ABCD12');
    expect(result.room?.status).toBe('waiting');
    expect(result.room?.lapTarget).toBe(3);
    expect(result.room?.expiresAt).toBe(new Date(START + 3_600_000).toISOString());
    expect(result.room?.players).toMatchObject([
      {
        playerId: 'host-1',
        nickname: 'Host',
        isHost: true,
        ready: false,
        color: null
      }
    ]);
  });

  it('rejects invalid auth tickets before mutating room state', async () => {
    const coordinator = createCoordinator();

    const result = await coordinator.execute({
      commandId: 'bad-ticket',
      type: 'room.create',
      playerId: 'host-1',
      authTicket: ticket('someone-else'),
      payload: { nickname: 'Host' }
    });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('AUTH_TICKET_INVALID');

    const snapshot = await coordinator.execute(command('sync.request', 'host-1', {}, 'sync-after-invalid'));
    expect(snapshot.ok).toBe(false);
    expect(snapshot.errorCode).toBe('ROOM_NOT_FOUND');
  });

  it('lets players join, choose unique colors, set lap target, and become ready', async () => {
    const coordinator = createCoordinator();

    await coordinator.execute(command('room.create', 'host-1', { nickname: 'Host' }));
    const join = await coordinator.execute(command('room.join', 'player-2', { nickname: 'Guest' }));
    const lap = await coordinator.execute(command('room.setLapTarget', 'host-1', { lapTarget: 5 }));
    const hostColor = await coordinator.execute(command('room.chooseColor', 'host-1', { color: 'yellow' }));
    const guestColor = await coordinator.execute(command('room.chooseColor', 'player-2', { color: 'green' }));
    const hostReady = await coordinator.execute(command('room.ready', 'host-1', { ready: true }));
    const guestReady = await coordinator.execute(command('room.ready', 'player-2', { ready: true }));

    expect(join.ok).toBe(true);
    expect(lap.room?.lapTarget).toBe(5);
    expect(hostColor.ok).toBe(true);
    expect(guestColor.ok).toBe(true);
    expect(hostReady.ok).toBe(true);
    expect(guestReady.room?.players).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ playerId: 'host-1', color: 'yellow', ready: true }),
        expect.objectContaining({ playerId: 'player-2', color: 'green', ready: true })
      ])
    );
  });

  it('returns specific validation errors for lap targets and colors', async () => {
    const coordinator = createCoordinator();

    await coordinator.execute(command('room.create', 'host-1', { nickname: 'Host' }));
    await coordinator.execute(command('room.join', 'player-2', { nickname: 'Guest' }));

    const invalidLap = await coordinator.execute(command('room.setLapTarget', 'host-1', { lapTarget: 11 }));
    const nonHostLap = await coordinator.execute(command('room.setLapTarget', 'player-2', { lapTarget: 4 }));
    const invalidColor = await coordinator.execute(command('room.chooseColor', 'host-1', { color: 'blue' }));
    await coordinator.execute(command('room.chooseColor', 'host-1', { color: 'yellow' }));
    const takenColor = await coordinator.execute(command('room.chooseColor', 'player-2', { color: 'yellow' }));

    expect(invalidLap).toMatchObject({ ok: false, errorCode: 'LAP_TARGET_INVALID' });
    expect(nonHostLap).toMatchObject({ ok: false, errorCode: 'ONLY_HOST_CAN_START' });
    expect(invalidColor).toMatchObject({ ok: false, errorCode: 'COLOR_INVALID' });
    expect(takenColor).toMatchObject({ ok: false, errorCode: 'COLOR_TAKEN' });
  });

  it('requires the host, every player readiness, and every player color before starting', async () => {
    const coordinator = createCoordinator();

    await coordinator.execute(command('room.create', 'host-1', { nickname: 'Host' }));
    await coordinator.execute(command('room.chooseColor', 'host-1', { color: 'yellow' }));
    await coordinator.execute(command('room.ready', 'host-1', { ready: true }));
    const singlePlayerStart = await coordinator.execute(command('room.start', 'host-1', {}));

    await coordinator.execute(command('room.join', 'player-2', { nickname: 'Guest' }));

    const nonHostStart = await coordinator.execute(command('room.start', 'player-2', {}));
    const missingGuestReadyAndColor = await coordinator.execute(command('room.start', 'host-1', {}));
    await coordinator.execute(command('room.chooseColor', 'player-2', { color: 'green' }));
    await coordinator.execute(command('room.ready', 'player-2', { ready: true }));
    const started = await coordinator.execute(command('room.start', 'host-1', {}));

    expect(singlePlayerStart).toMatchObject({ ok: false, errorCode: 'MIN_PLAYERS_REQUIRED' });
    expect(nonHostStart).toMatchObject({ ok: false, errorCode: 'ONLY_HOST_CAN_START' });
    expect(missingGuestReadyAndColor).toMatchObject({ ok: false, errorCode: 'NOT_ALL_PLAYERS_READY' });
    expect(started.ok).toBe(true);
    expect(started.room?.status).toBe('racing');
    expect(started.room?.startedAt).toBe(new Date(START).toISOString());
  });

  it('closes waiting rooms that pass the 60 minute expiration window', async () => {
    const storage = new InMemoryRoomStorage();
    const coordinator = new RoomCoordinator(storage, {
      now: () => START,
      roomCodeGenerator: () => 'ABCD12'
    });
    await coordinator.execute(command('room.create', 'host-1', { nickname: 'Host' }));

    const expiredCoordinator = new RoomCoordinator(storage, {
      now: () => START + 3_600_001,
      roomCodeGenerator: () => 'IGNORED'
    });
    const expiredAt = START + 3_600_001;
    const expired = await expiredCoordinator.execute(command('room.closeExpired', 'host-1', {}, 'close-expired', expiredAt));
    const joinAfterClose = await expiredCoordinator.execute(command('room.join', 'player-2', { nickname: 'Guest' }, 'join-after-close', expiredAt));

    expect(expired.ok).toBe(true);
    expect(expired.room?.status).toBe('closed');
    expect(expired.room?.closedReason).toBe('not_started_timeout');
    expect(joinAfterClose).toMatchObject({ ok: false, errorCode: 'ROOM_CLOSED' });
  });

  it('returns ROOM_EXPIRED when a waiting room is touched after expiration before cleanup', async () => {
    const storage = new InMemoryRoomStorage();
    const coordinator = new RoomCoordinator(storage, {
      now: () => START,
      roomCodeGenerator: () => 'ABCD12'
    });
    await coordinator.execute(command('room.create', 'host-1', { nickname: 'Host' }));

    const expiredCoordinator = new RoomCoordinator(storage, {
      now: () => START + 3_600_001,
      roomCodeGenerator: () => 'IGNORED'
    });
    const result = await expiredCoordinator.execute(command('room.join', 'player-2', { nickname: 'Guest' }, 'join-expired', START + 3_600_001));

    expect(result).toMatchObject({ ok: false, errorCode: 'ROOM_EXPIRED' });
  });
});
