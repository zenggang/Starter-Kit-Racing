export interface VerifiedCoordinatorTicket {
  playerId: string;
  nickname: string;
  roomCode?: string;
  issuedAt: number;
  expiresAt: number;
}

/**
 * Verifies the server-issued HMAC ticket before a public Worker route can reach
 * the Durable Object. The DO still checks player ownership and expiry from the
 * command payload, while this edge check prevents direct forged HTTP commands.
 */
export async function verifyCoordinatorBearerToken(
  request: Request,
  sharedSecret: string | undefined,
  now = Date.now()
): Promise<VerifiedCoordinatorTicket | null> {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  return verifyCoordinatorToken(token, sharedSecret, now);
}

export async function verifyCoordinatorToken(
  token: string | null | undefined,
  sharedSecret: string | undefined,
  now = Date.now()
): Promise<VerifiedCoordinatorTicket | null> {
  if (!token || !sharedSecret) return null;

  const [body, signature] = token.split('.');
  if (!body || !signature) return null;

  const expected = await signBase64UrlBody(body, sharedSecret);
  if (!constantTimeEqual(signature, expected)) return null;

  const payload = decodeTicketPayload(body);
  if (!payload) return null;

  if (payload.issuedAt > now || payload.expiresAt <= now) return null;

  return payload;
}

async function signBase64UrlBody(body: string, sharedSecret: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(sharedSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  return bytesToBase64Url(new Uint8Array(signature));
}

function decodeTicketPayload(body: string): VerifiedCoordinatorTicket | null {
  try {
    const payload = JSON.parse(new TextDecoder().decode(base64UrlToBytes(body))) as Partial<VerifiedCoordinatorTicket>;
    const playerId = payload.playerId;
    const nickname = payload.nickname;
    const roomCode = payload.roomCode;
    const issuedAt = payload.issuedAt;
    const expiresAt = payload.expiresAt;

    if (
      typeof playerId !== 'string' ||
      typeof nickname !== 'string' ||
      typeof issuedAt !== 'number' ||
      typeof expiresAt !== 'number' ||
      (roomCode !== undefined && typeof roomCode !== 'string')
    ) {
      return null;
    }

    if (!Number.isFinite(issuedAt) || !Number.isFinite(expiresAt)) {
      return null;
    }

    return {
      playerId,
      nickname,
      roomCode,
      issuedAt,
      expiresAt
    };
  } catch {
    return null;
  }
}

function constantTimeEqual(left: string, right: string): boolean {
  const maxLength = Math.max(left.length, right.length);
  let diff = left.length ^ right.length;

  for (let index = 0; index < maxLength; index += 1) {
    diff |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }

  return diff === 0;
}

function base64UrlToBytes(value: string): Uint8Array {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '');
}
