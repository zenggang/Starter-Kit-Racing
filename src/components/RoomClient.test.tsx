import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RoomClient } from './RoomClient';

const replaceSpy = vi.fn();
const sendCommandSpy = vi.fn().mockResolvedValue({
  type: 'command.result',
  seq: 2,
  ok: true,
  room: {
    id: 'room-1',
    code: '8966',
    hostPlayerId: 'player-1',
    status: 'closed',
    lapTarget: 3,
    trackMap: null,
    createdAt: '2026-05-02T10:00:00.000Z',
    startedAt: null,
    finishedAt: null,
    expiresAt: '2026-05-02T11:00:00.000Z',
    closedReason: 'room_empty',
    matchId: null,
    players: []
  }
});

vi.stubGlobal('React', React);

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: replaceSpy
  })
}));

vi.mock('@/session/usePlayerSession', () => ({
  usePlayerSession: () => ({
    session: {
      playerId: 'player-1',
      nickname: '车手1',
      lastRoomCode: '8966'
    },
    rememberRoom: vi.fn()
  })
}));

vi.mock('@/realtime/useRoomSession', () => ({
  useRoomSession: () => ({
    snapshot: {
      id: 'room-1',
      code: '8966',
      hostPlayerId: 'player-1',
      status: 'waiting',
      lapTarget: 3,
      trackMap: null,
      createdAt: '2026-05-02T10:00:00.000Z',
      startedAt: null,
      finishedAt: null,
      expiresAt: '2026-05-02T11:00:00.000Z',
      closedReason: null,
      matchId: null,
      players: [
        {
          playerId: 'player-1',
          nickname: '车手1',
          color: 'yellow',
          status: 'ready',
          ready: true,
          isHost: true,
          lastSeenAt: '2026-05-02T10:00:00.000Z'
        }
      ]
    },
    connectionState: 'connected',
    lastErrorCode: null,
    sendCommand: sendCommandSpy
  })
}));

describe('RoomClient', () => {
  it('sends room.leave and returns to the hall when the racer exits the room', async () => {
    render(<RoomClient code="8966" />);

    fireEvent.click(screen.getByRole('button', { name: '退出房间' }));

    await waitFor(() => {
      expect(sendCommandSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'room.leave',
          playerId: 'player-1'
        })
      );
    });
    await waitFor(() => {
      expect(replaceSpy).toHaveBeenCalledWith('/');
    });
  });
});
