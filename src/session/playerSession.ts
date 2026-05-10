import { createClientUuid } from '@/utils/clientUuid';

const PLAYER_ID_KEY = 'racing.playerId';
const NICKNAME_KEY = 'racing.nickname';
const LAST_ROOM_CODE_KEY = 'racing.lastRoomCode';
const DEFAULT_NICKNAME_PREFIX = 'Racer';
const MAX_NICKNAME_LENGTH = 20;

export interface PlayerSession {
  playerId: string;
  nickname: string;
  lastRoomCode: string | null;
}

export interface PlayerSessionStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/**
 * Owns the browser identity used for room commands. This module deliberately
 * stores only client identity hints; room membership, ready state and color are
 * still owned by the coordinator.
 */
export function getOrCreatePlayerSession(storage: PlayerSessionStorage, nicknameInput?: string | null): PlayerSession {
  let playerId = storage.getItem(PLAYER_ID_KEY);

  if (!playerId) {
    playerId = createClientUuid();
    storage.setItem(PLAYER_ID_KEY, playerId);
  }

  const storedNickname = storage.getItem(NICKNAME_KEY);
  const rawNickname =
    nicknameInput !== undefined && nicknameInput !== null
      ? nicknameInput.trim().slice(0, MAX_NICKNAME_LENGTH)
      : storedNickname === null
        ? normalizeNickname('', playerId)
        : storedNickname.trim().slice(0, MAX_NICKNAME_LENGTH);
  storage.setItem(NICKNAME_KEY, rawNickname);

  return {
    playerId,
    nickname: rawNickname,
    lastRoomCode: storage.getItem(LAST_ROOM_CODE_KEY)
  };
}

export function rememberLastRoomCode(storage: PlayerSessionStorage, roomCode: string): void {
  storage.setItem(LAST_ROOM_CODE_KEY, roomCode.trim().toUpperCase());
}

export function setStoredNickname(storage: PlayerSessionStorage, nickname: string): void {
  storage.setItem(NICKNAME_KEY, nickname.trim().slice(0, MAX_NICKNAME_LENGTH));
}

export function resolveSessionNickname(session: Pick<PlayerSession, 'playerId' | 'nickname'>): string {
  return normalizeNickname(session.nickname, session.playerId);
}

export function normalizeNickname(input: string | null | undefined, playerId: string): string {
  const trimmed = input?.trim() ?? '';

  if (!trimmed) {
    return `${DEFAULT_NICKNAME_PREFIX}${playerId.replace(/-/g, '').slice(0, 4).toUpperCase()}`;
  }

  return trimmed.slice(0, MAX_NICKNAME_LENGTH);
}
