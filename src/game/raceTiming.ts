import type { MatchPlayerState, MatchState } from '@/realtime/protocol';

/**
 * Race HUD and result cards both read from the same coordinator timestamps.
 * Keeping the formatting and countdown math in one file avoids subtle drift
 * between live overlays and the final standings page.
 */
export function formatRaceDuration(milliseconds: number | null | undefined): string {
  if (milliseconds === null || milliseconds === undefined || !Number.isFinite(milliseconds)) {
    return '--:--.---';
  }

  const safeMilliseconds = Math.max(0, Math.floor(milliseconds));
  const minutes = Math.floor(safeMilliseconds / 60_000);
  const seconds = Math.floor((safeMilliseconds % 60_000) / 1_000);
  const millis = safeMilliseconds % 1_000;

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
}

export function getRaceElapsedMs(match: Pick<MatchState, 'startedAt' | 'finishedAt' | 'phase'>, now = Date.now()): number {
  const startedAt = Date.parse(match.startedAt);
  const endedAt = match.phase === 'finished' && match.finishedAt ? Date.parse(match.finishedAt) : now;
  return Math.max(0, endedAt - startedAt);
}

export function getPlayerRaceTimeMs(
  match: Pick<MatchState, 'startedAt'>,
  player: Pick<MatchPlayerState, 'finishedAt'>
): number | null {
  if (!player.finishedAt) {
    return null;
  }

  return Math.max(0, Date.parse(player.finishedAt) - Date.parse(match.startedAt));
}

export function getFinishDeadlineRemainingMs(
  match: Pick<MatchState, 'phase' | 'finishDeadlineAt'>,
  now = Date.now()
): number | null {
  if (match.phase !== 'live' || !match.finishDeadlineAt) {
    return null;
  }

  return Math.max(0, Date.parse(match.finishDeadlineAt) - now);
}
