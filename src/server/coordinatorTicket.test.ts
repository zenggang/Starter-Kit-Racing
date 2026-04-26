import { describe, expect, it } from 'vitest';
import { signCoordinatorTicket, verifyCoordinatorTicket } from './coordinatorTicket';

describe('coordinator tickets', () => {
  it('round-trips a signed payload', () => {
    const token = signCoordinatorTicket(
      {
        playerId: 'player-1',
        nickname: 'Racer',
        roomCode: 'ABCD',
        issuedAt: 1000,
        expiresAt: 2000
      },
      'secret'
    );

    expect(verifyCoordinatorTicket(token, 'secret', 1000)).toEqual({
      playerId: 'player-1',
      nickname: 'Racer',
      roomCode: 'ABCD',
      issuedAt: 1000,
      expiresAt: 2000
    });
  });

  it('rejects expired or tampered tickets', () => {
    const token = signCoordinatorTicket({ playerId: 'player-1', nickname: 'Racer', issuedAt: 0, expiresAt: 1000 }, 'secret');

    expect(verifyCoordinatorTicket(token, 'secret', 1001)).toBeNull();
    expect(verifyCoordinatorTicket(`${token}x`, 'secret', 999)).toBeNull();
    expect(verifyCoordinatorTicket(token, 'other-secret', 999)).toBeNull();
  });
});
