import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyCoordinatorBearerToken } from '../src/auth';

function signTicket(payload: Record<string, unknown>, sharedSecret: string): string {
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = createHmac('sha256', sharedSecret).update(body).digest('base64url');
  return `${body}.${signature}`;
}

function requestWithBearer(token: string): Request {
  return new Request('https://worker.test/rooms', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`
    }
  });
}

describe('Worker coordinator ticket verification', () => {
  it('accepts a valid Next-issued coordinator ticket', async () => {
    const token = signTicket({ playerId: 'player-1', issuedAt: 1_000, expiresAt: 2_000 }, 'secret');

    await expect(verifyCoordinatorBearerToken(requestWithBearer(token), 'secret', 1_500)).resolves.toEqual({
      playerId: 'player-1',
      issuedAt: 1_000,
      expiresAt: 2_000
    });
  });

  it('rejects missing, expired, or tampered coordinator tickets', async () => {
    const token = signTicket({ playerId: 'player-1', issuedAt: 1_000, expiresAt: 2_000 }, 'secret');

    await expect(verifyCoordinatorBearerToken(new Request('https://worker.test/rooms'), 'secret', 1_500)).resolves.toBeNull();
    await expect(verifyCoordinatorBearerToken(requestWithBearer(token), 'secret', 2_000)).resolves.toBeNull();
    await expect(verifyCoordinatorBearerToken(requestWithBearer(`${token}x`), 'secret', 1_500)).resolves.toBeNull();
    await expect(verifyCoordinatorBearerToken(requestWithBearer(token), 'other-secret', 1_500)).resolves.toBeNull();
  });
});
