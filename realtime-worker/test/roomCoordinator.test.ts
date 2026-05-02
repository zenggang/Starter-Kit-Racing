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

  it('lets the host start alone after choosing a color and getting ready', async () => {
    const coordinator = createCoordinator();

    await coordinator.execute(command('room.create', 'host-1', { nickname: 'Host' }));
    await coordinator.execute(command('room.chooseColor', 'host-1', { color: 'yellow' }));
    await coordinator.execute(command('room.ready', 'host-1', { ready: true }));

    const started = await coordinator.execute(command('room.start', 'host-1', {}));

    expect(started.ok).toBe(true);
    expect(started.room?.status).toBe('racing');
    expect(started.room?.startedAt).toBe(new Date(START).toISOString());
    expect(started.match?.players).toEqual([
      expect.objectContaining({
        playerId: 'host-1',
        color: 'yellow'
      })
    ]);
  });

  it('still requires the host, and includes ready guests when a multiplayer room starts', async () => {
    const coordinator = createCoordinator();

    await coordinator.execute(command('room.create', 'host-1', { nickname: 'Host' }));
    await coordinator.execute(command('room.chooseColor', 'host-1', { color: 'yellow' }));
    await coordinator.execute(command('room.ready', 'host-1', { ready: true }));

    await coordinator.execute(command('room.join', 'player-2', { nickname: 'Guest' }));

    const nonHostStart = await coordinator.execute(command('room.start', 'player-2', {}));
    await coordinator.execute(command('room.chooseColor', 'player-2', { color: 'green' }));
    await coordinator.execute(command('room.ready', 'player-2', { ready: true }));
    const started = await coordinator.execute(command('room.start', 'host-1', {}));

    expect(nonHostStart).toMatchObject({ ok: false, errorCode: 'ONLY_HOST_CAN_START' });
    expect(started.ok).toBe(true);
    expect(started.room?.status).toBe('racing');
    expect(started.room?.startedAt).toBe(new Date(START).toISOString());
    expect(started.match?.players).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ playerId: 'host-1', color: 'yellow' }),
        expect.objectContaining({ playerId: 'player-2', color: 'green' })
      ])
    );
  });

  it('does not let an unready guest block the host from running the single-player path', async () => {
    const coordinator = createCoordinator();

    await coordinator.execute(command('room.create', 'host-1', { nickname: 'Host' }));
    await coordinator.execute(command('room.chooseColor', 'host-1', { color: 'yellow' }));
    await coordinator.execute(command('room.ready', 'host-1', { ready: true }));
    await coordinator.execute(command('room.join', 'player-2', { nickname: 'Guest' }));

    const started = await coordinator.execute(command('room.start', 'host-1', {}));

    expect(started.ok).toBe(true);
    expect(started.match?.players).toEqual([
      expect.objectContaining({
        playerId: 'host-1',
        color: 'yellow'
      })
    ]);
    expect(started.room?.players).toEqual([
      expect.objectContaining({
        playerId: 'host-1'
      })
    ]);
  });

  it('tracks match progress, finalizes results, and allows the host to rematch', async () => {
    const coordinator = createCoordinator();

    await coordinator.execute(command('room.create', 'host-1', { nickname: 'Host' }));
    await coordinator.execute(command('room.join', 'player-2', { nickname: 'Guest' }));
    await coordinator.execute(command('room.chooseColor', 'host-1', { color: 'yellow' }));
    await coordinator.execute(command('room.chooseColor', 'player-2', { color: 'green' }));
    await coordinator.execute(command('room.ready', 'host-1', { ready: true }));
    await coordinator.execute(command('room.ready', 'player-2', { ready: true }));
    const started = await coordinator.execute(command('room.start', 'host-1', {}));

    expect(started.match?.phase).toBe('live');
    expect(started.match?.players).toHaveLength(2);

    await coordinator.execute(command('match.join', 'host-1', {}));
    await coordinator.execute(command('match.join', 'player-2', {}));

    const hostProgress = await coordinator.execute(
      command('match.progress', 'host-1', {
        checkpoint: 2,
        completedLaps: 1,
        lapProgress: 0.35,
        position: { x: 1, y: 0.5, z: 2 },
        heading: 0,
        speed: 0.8
      })
    );

    expect(hostProgress.match?.players.find((player) => player.playerId === 'host-1')).toMatchObject({
      completedLaps: 1,
      lapProgress: 0.35,
      rank: 1
    });

    await coordinator.execute(
      command('match.progress', 'host-1', {
        checkpoint: 0,
        completedLaps: 3,
        lapProgress: 1,
        position: { x: 3, y: 0.5, z: 4 },
        heading: 0.5,
        speed: 1.1,
        finished: true
      })
    );

    const finished = await coordinator.execute(
      command('match.progress', 'player-2', {
        checkpoint: 0,
        completedLaps: 3,
        lapProgress: 1,
        position: { x: 4, y: 0.5, z: 5 },
        heading: 0.3,
        speed: 1.0,
        finished: true
      })
    );

    expect(finished.room?.status).toBe('finished');
    expect(finished.match?.phase).toBe('finished');
    expect(finished.match?.winnerPlayerId).toBe('host-1');
    expect(finished.match?.players.map((player) => player.rank)).toEqual([1, 2]);

    const rematch = await coordinator.execute(command('room.rematch', 'host-1', {}));

    expect(rematch.room).toMatchObject({
      status: 'waiting',
      matchId: null,
      startedAt: null,
      finishedAt: null
    });
    expect(rematch.match).toBeUndefined();
    expect(rematch.room?.players).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ playerId: 'host-1', ready: false }),
        expect.objectContaining({ playerId: 'player-2', ready: false })
      ])
    );
  });

  it('opens a 60 second finish window after the leader finishes and marks trailing racers as unfinished at timeout', async () => {
    let now = START;
    const coordinator = new RoomCoordinator(new InMemoryRoomStorage(), {
      now: () => now,
      roomCodeGenerator: () => 'ABCD12'
    });

    await coordinator.execute(command('room.create', 'host-1', { nickname: 'Host' }, 'room.create:host-1', now));
    await coordinator.execute(command('room.join', 'player-2', { nickname: 'Guest' }, 'room.join:player-2', now));
    await coordinator.execute(command('room.chooseColor', 'host-1', { color: 'yellow' }, 'room.chooseColor:host-1', now));
    await coordinator.execute(command('room.chooseColor', 'player-2', { color: 'green' }, 'room.chooseColor:player-2', now));
    await coordinator.execute(command('room.ready', 'host-1', { ready: true }, 'room.ready:host-1', now));
    await coordinator.execute(command('room.ready', 'player-2', { ready: true }, 'room.ready:player-2', now));
    await coordinator.execute(command('room.start', 'host-1', {}, 'room.start:host-1', now));

    now += 5_000;
    const leaderFinished = await coordinator.execute(
      command(
        'match.progress',
        'host-1',
        {
          checkpoint: 0,
          completedLaps: 3,
          lapProgress: 1,
          position: { x: 8, y: 0.5, z: 4 },
          heading: 0.1,
          speed: 1.2,
          finished: true
        },
        'match.progress:host-finish',
        now
      )
    );

    expect(leaderFinished.match).toMatchObject({
      phase: 'live',
      winnerPlayerId: 'host-1',
      finishDeadlineAt: new Date(now + 60_000).toISOString()
    });
    expect(leaderFinished.room?.status).toBe('racing');

    now += 60_001;
    const timedOut = await coordinator.execute(command('match.sync', 'player-2', {}, 'match.sync:player-2', now));

    expect(timedOut.room?.status).toBe('finished');
    expect(timedOut.match).toMatchObject({
      phase: 'finished',
      winnerPlayerId: 'host-1'
    });
    expect(timedOut.match?.players).toEqual([
      expect.objectContaining({
        playerId: 'host-1',
        rank: 1,
        finishedAt: expect.any(String)
      }),
      expect.objectContaining({
        playerId: 'player-2',
        rank: 2,
        finishedAt: null
      })
    ]);
  });

  it('completes a full single-player online race and reopens the room for rematch', async () => {
    const coordinator = createCoordinator();

    await coordinator.execute(command('room.create', 'host-1', { nickname: 'Host' }));
    await coordinator.execute(command('room.setLapTarget', 'host-1', { lapTarget: 2 }));
    await coordinator.execute(command('room.chooseColor', 'host-1', { color: 'yellow' }));
    await coordinator.execute(command('room.ready', 'host-1', { ready: true }));

    const started = await coordinator.execute(command('room.start', 'host-1', {}));
    expect(started.ok).toBe(true);
    expect(started.room?.status).toBe('racing');
    expect(started.match?.players).toHaveLength(1);

    await coordinator.execute(command('match.join', 'host-1', {}));

    const finished = await coordinator.execute(
      command('match.progress', 'host-1', {
        checkpoint: 0,
        completedLaps: 2,
        lapProgress: 1,
        position: { x: 10, y: 0.5, z: 8 },
        heading: 0.2,
        speed: 1,
        finished: true
      })
    );

    expect(finished.room).toMatchObject({
      status: 'finished',
      lapTarget: 2
    });
    expect(finished.match).toMatchObject({
      phase: 'finished',
      winnerPlayerId: 'host-1'
    });
    expect(finished.match?.players).toEqual([
      expect.objectContaining({
        playerId: 'host-1',
        rank: 1,
        completedLaps: 2,
        finishedAt: expect.any(String)
      })
    ]);

    const rematch = await coordinator.execute(command('room.rematch', 'host-1', {}));

    expect(rematch.room).toMatchObject({
      status: 'waiting',
      startedAt: null,
      finishedAt: null,
      matchId: null
    });
    expect(rematch.match).toBeUndefined();
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
