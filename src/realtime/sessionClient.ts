import type { CommandResult, RealtimeMessage, RoomCommandEnvelope, TransportMode } from './protocol';

export interface CoordinatorTicket {
  token: string;
  url: string;
  mode: TransportMode;
}

export interface TicketIdentity {
  playerId: string;
  nickname: string;
  roomCode?: string;
}

/**
 * Requests a server-signed coordinator ticket. The server picks exactly one
 * transport mode so mobile browsers do not have to guess between socket and
 * same-origin bridge behavior.
 */
export async function requestCoordinatorTicket(identity: TicketIdentity): Promise<CoordinatorTicket> {
  const response = await fetch('/api/coordinator-ticket', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(identity)
  });
  const body = await response.json();

  if (!response.ok || !body.ok) {
    throw new Error(body.errorCode ?? 'COORDINATOR_NOT_READY');
  }

  return {
    token: body.token,
    url: body.url,
    mode: body.mode
  };
}

export async function sendBridgeCommand(roomCode: string, ticket: CoordinatorTicket, command: RoomCommandEnvelope): Promise<CommandResult> {
  const response = await fetch(`/api/coordinator-bridge/room/${encodeURIComponent(roomCode)}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${ticket.token}`
    },
    body: JSON.stringify(command)
  });
  const body = await response.json();

  if (!response.ok && !body.type) {
    return {
      type: 'command.result',
      seq: 0,
      ok: false,
      commandId: command.commandId,
      errorCode: body.errorCode ?? 'COORDINATOR_NOT_READY'
    };
  }

  return body;
}

export function openCoordinatorSocket(roomCode: string, ticket: CoordinatorTicket, onMessage: (message: RealtimeMessage) => void): WebSocket {
  const baseUrl = ticket.url.replace(/\/$/, '');
  const url = new URL(`${baseUrl}/rooms/${encodeURIComponent(roomCode)}/socket`);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.searchParams.set('token', ticket.token);

  const socket = new WebSocket(url.toString());
  socket.addEventListener('message', (event) => {
    onMessage(JSON.parse(event.data) as RealtimeMessage);
  });

  return socket;
}
