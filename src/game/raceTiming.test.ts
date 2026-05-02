import { describe, expect, it } from 'vitest';
import { formatRaceDuration, getFinishDeadlineRemainingMs, getPlayerRaceTimeMs } from './raceTiming';
import type { MatchPlayerState, MatchState } from '@/realtime/protocol';

const basePlayer: MatchPlayerState = {
  playerId: 'player-1',
  nickname: 'LocalRacer',
  color: 'yellow',
  isHost: true,
  presence: 'connected',
  rank: 1,
  position: { x: 0, y: 0.5, z: 0 },
  heading: 0,
  speed: 0,
  checkpoint: 0,
  completedLaps: 0,
  lapProgress: 0,
  totalProgress: 0,
  lastReportAt: null,
  finishedAt: null
};

const baseMatch: MatchState = {
  id: 'match-1',
  roomCode: 'ABCD12',
  phase: 'live',
  lapTarget: 3,
  trackMap: null,
  startedAt: '2026-05-02T00:00:00.000Z',
  finishedAt: null,
  finishDeadlineAt: null,
  winnerPlayerId: null,
  players: [basePlayer]
};

describe('race timing helpers', () => {
  it('formats elapsed milliseconds into kart-style race clock text', () => {
    expect(formatRaceDuration(0)).toBe('00:00.000');
    expect(formatRaceDuration(65_432)).toBe('01:05.432');
    expect(formatRaceDuration(null)).toBe('--:--.---');
  });

  it('derives a player finish time from match start and finished timestamp', () => {
    const finishedPlayer = {
      ...basePlayer,
      finishedAt: '2026-05-02T00:01:12.345Z'
    };

    expect(getPlayerRaceTimeMs(baseMatch, finishedPlayer)).toBe(72_345);
    expect(getPlayerRaceTimeMs(baseMatch, basePlayer)).toBeNull();
  });

  it('returns the remaining finish countdown once the leader has opened the timeout window', () => {
    const liveMatch = {
      ...baseMatch,
      finishDeadlineAt: '2026-05-02T00:02:00.000Z'
    };

    expect(getFinishDeadlineRemainingMs(liveMatch, Date.parse('2026-05-02T00:01:30.000Z'))).toBe(30_000);
    expect(getFinishDeadlineRemainingMs(liveMatch, Date.parse('2026-05-02T00:02:05.000Z'))).toBe(0);
    expect(getFinishDeadlineRemainingMs(baseMatch, Date.parse('2026-05-02T00:01:30.000Z'))).toBeNull();
  });
});
