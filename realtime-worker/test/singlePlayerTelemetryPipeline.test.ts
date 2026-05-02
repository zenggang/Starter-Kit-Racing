import { describe, expect, it } from 'vitest';
import { advanceRaceProgress, buildTrackProgressModel, createInitialRaceProgressState } from '../../src/game/trackProgress';
import { RoomCoordinator } from '../src/RoomCoordinator';
import { InMemoryRoomStorage } from '../src/storage';
import type { AuthTicket, RoomCommandEnvelope } from '../src/protocol';

const START = Date.parse('2026-05-02T00:00:00.000Z');

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

describe('single-player telemetry pipeline', () => {
  it('turns runtime path samples into advancing match progress and a finished result', async () => {
    const coordinator = new RoomCoordinator(new InMemoryRoomStorage(), {
      now: () => START,
      roomCodeGenerator: () => 'DEMO12',
      matchIdGenerator: () => 'match-demo-1'
    });

    await coordinator.execute(command('room.create', 'player-1', { nickname: 'LocalRacer' }));
    await coordinator.execute(command('room.setLapTarget', 'player-1', { lapTarget: 1 }));
    await coordinator.execute(command('room.chooseColor', 'player-1', { color: 'yellow' }));
    await coordinator.execute(command('room.ready', 'player-1', { ready: true }));
    await coordinator.execute(command('room.start', 'player-1', {}));
    await coordinator.execute(command('match.join', 'player-1', {}));

    const model = buildTrackProgressModel(null);
    let state = createInitialRaceProgressState();
    let lastResult = null;

    for (let loop = 0; loop < 2; loop += 1) {
      for (let index = 0; index < model.points.length; index += 1) {
        const point = model.points[index];
        const telemetry = advanceRaceProgress(
          model,
          state,
          {
            position: { x: point.x, y: 0.5, z: point.z },
            heading: 0,
            speed: 1,
            driftIntensity: 0
          },
          1
        );
        state = telemetry.state;
        lastResult = await coordinator.execute(command('match.progress', 'player-1', telemetry.payload, `progress-${loop}-${index}`));

        if (lastResult.match?.phase === 'finished') {
          break;
        }
      }

      if (lastResult?.match?.phase === 'finished') {
        break;
      }
    }

    expect(lastResult?.match?.players[0]).toMatchObject({
      completedLaps: 1
    });
    expect(lastResult?.match?.phase).toBe('finished');
    expect(lastResult?.room?.status).toBe('finished');
  });
});
