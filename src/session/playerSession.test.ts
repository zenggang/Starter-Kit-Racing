import { afterEach, describe, expect, it, vi } from 'vitest';
import { getOrCreatePlayerSession, normalizeNickname, rememberLastRoomCode, resolveSessionNickname, setStoredNickname, type PlayerSessionStorage } from './playerSession';

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
  afterEach(() => {
    vi.restoreAllMocks();
  });

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

  it('allows the stored nickname to stay empty until a network command needs a fallback', () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('abcdef00-0000-0000-0000-000000000000');
    const storage = createMemoryStorage();

    setStoredNickname(storage, '   ');

    const session = getOrCreatePlayerSession(storage);
    expect(session.nickname).toBe('');
    expect(resolveSessionNickname(session)).toBe('RacerABCD');
  });

  it('falls back to getRandomValues when randomUUID is unavailable on insecure HTTP entries', () => {
    const storage = createMemoryStorage();
    const originalRandomUUID = crypto.randomUUID;
    const bytes = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);

    Object.defineProperty(crypto, 'randomUUID', {
      value: undefined,
      configurable: true
    });
    vi.spyOn(crypto, 'getRandomValues').mockImplementation((buffer) => {
      buffer.set(bytes);
      return buffer;
    });

    const session = getOrCreatePlayerSession(storage);

    expect(session.playerId).toBe('00010203-0405-4607-8809-0a0b0c0d0e0f');
    expect(session.nickname).toBe('Racer0001');

    Object.defineProperty(crypto, 'randomUUID', {
      value: originalRandomUUID,
      configurable: true
    });
  });
});
