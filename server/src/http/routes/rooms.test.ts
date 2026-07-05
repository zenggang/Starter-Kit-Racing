import { describe, expect, it } from 'vitest';
import { buildWaitingRoomListQuery } from './rooms.js';

describe('room routes waiting-room list query', () => {
  it('returns no query when the current realtime process has no active waiting rooms', () => {
    expect(buildWaitingRoomListQuery([])).toBeNull();
  });

  it('filters MySQL waiting-room projection by active Colyseus room ids', () => {
    const query = buildWaitingRoomListQuery(['4459', '4816']);

    expect(query).not.toBeNull();
    expect(query?.params).toEqual(['4459', '4816']);
    expect(query?.sql).toContain('r.code in (?, ?)');
    expect(query?.sql).toContain("r.status = 'waiting'");
    expect(query?.sql).toContain('r.expires_at > utc_timestamp()');
  });
});
