import { describe, expect, it, vi } from 'vitest';
import { getOrCreatePlayerSession, normalizeNickname, rememberLastRoomCode, setStoredNickname, type PlayerSessionStorage } from './playerSession';

function createMemoryStorage(): PlayerSessionStorage {
  const values = new Map<string, string>();

  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    }
  };
}

describe('player session', () => {
  it('creates and reuses a stable player id', () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('12345678-1234-1234-1234-123456789abc');
    const storage = createMemoryStorage();

    const first = getOrCreatePlayerSession(storage);
    const second = getOrCreatePlayerSession(storage);

    expect(first.playerId).toBe('12345678-1234-1234-1234-123456789abc');
    expect(second.playerId).toBe(first.playerId);
    expect(second.nickname).toBe('Racer1234');
  });

  it('normalizes empty and long nicknames', () => {
    expect(normalizeNickname('', 'abcdef00-0000-0000-0000-000000000000')).toBe('RacerABCD');
    expect(normalizeNickname('  ThisNicknameIsLongerThanTwentyChars  ', 'id')).toBe('ThisNicknameIsLonger');
  });

  it('stores the last room code in canonical uppercase form', () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('abcdef00-0000-0000-0000-000000000000');
    const storage = createMemoryStorage();

    rememberLastRoomCode(storage, ' ab12 ');

    expect(getOrCreatePlayerSession(storage).lastRoomCode).toBe('AB12');
  });

  it('stores a custom nickname and reuses it for later sessions', () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('abcdef00-0000-0000-0000-000000000000');
    const storage = createMemoryStorage();

    setStoredNickname(storage, '  DriftKing  ');

    expect(getOrCreatePlayerSession(storage).nickname).toBe('DriftKing');
  });
});
