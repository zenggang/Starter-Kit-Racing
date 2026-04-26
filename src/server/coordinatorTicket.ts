import { createHmac, timingSafeEqual } from 'node:crypto';

export interface CoordinatorTicketPayload {
  playerId: string;
  nickname: string;
  roomCode?: string;
  issuedAt: number;
  expiresAt: number;
}

/**
 * Signs short-lived coordinator tickets used by browser clients and the bridge
 * route. The payload carries only connection identity; the shared secret stays
 * server-side and is never sent to the browser.
 */
export function signCoordinatorTicket(payload: CoordinatorTicketPayload, sharedSecret: string): string {
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = createHmac('sha256', sharedSecret).update(body).digest('base64url');

  return `${body}.${signature}`;
}

export function verifyCoordinatorTicket(token: string, sharedSecret: string, now = Date.now()): CoordinatorTicketPayload | null {
  const [body, signature] = token.split('.');
  if (!body || !signature) return null;

  const expected = createHmac('sha256', sharedSecret).update(body).digest('base64url');
  const providedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (providedBuffer.length !== expectedBuffer.length || !timingSafeEqual(providedBuffer, expectedBuffer)) {
    return null;
  }

  const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as CoordinatorTicketPayload;

  if (payload.expiresAt < now) return null;

  return payload;
}
