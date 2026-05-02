import { PLAYER_COLORS, type RoomPlayer } from '@/realtime/protocol';

export type RosterDensity = 'standard' | 'compact';

/**
 * Lobby and result rosters need a denser layout once the normal showcase cards
 * would squeeze 3-4 racers into unreadable widths on landscape tablets. The
 * lobby can also reserve the full seat bay up front so hosts always see the
 * room's real four-car capacity.
 */
export function getRosterDensity(playerCount: number, options?: { reserveCapacity?: boolean }): RosterDensity {
  if (options?.reserveCapacity) {
    return 'compact';
  }

  return playerCount >= 3 ? 'compact' : 'standard';
}

/**
 * The room screen always renders the full four-seat bay rather than only the
 * occupied entries. That makes remaining capacity obvious and lets the layout
 * stay stable while racers join one by one.
 */
export function createLobbySeatSlots(players: RoomPlayer[]): Array<RoomPlayer | null> {
  return Array.from({ length: PLAYER_COLORS.length }, (_, index) => players[index] ?? null);
}
