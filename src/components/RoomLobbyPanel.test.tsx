import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RoomLobbyPanel } from './RoomLobbyPanel';
import type { RoomState } from '@/realtime/protocol';
import type { PlayerSession } from '@/session/playerSession';

vi.mock('next/link', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

vi.mock('./ColorPicker', () => ({
  ColorPicker: () => <div data-testid="color-picker" />
}));

vi.mock('./LapTargetControl', () => ({
  LapTargetControl: () => <div data-testid="lap-target-control" />
}));

function createRoomPlayer(index: number, overrides: Partial<RoomState['players'][number]> = {}): RoomState['players'][number] {
  const colors = ['yellow', 'green', 'purple', 'red'] as const;

  return {
    playerId: `player-${index}`,
    nickname: `车手${index}`,
    color: colors[index - 1] ?? null,
    status: 'ready',
    ready: true,
    isHost: index === 1,
    lastSeenAt: '2026-05-02T10:00:00.000Z',
    ...overrides
  };
}

describe('RoomLobbyPanel', () => {
  it('keeps a visible four-seat bay even before the lobby fills up', () => {
    const player: PlayerSession = {
      playerId: 'player-1',
      nickname: '车手1',
      lastRoomCode: '8966'
    };

    const room: RoomState = {
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
      players: [createRoomPlayer(1)]
    };

    const { container } = render(
      <RoomLobbyPanel room={room} player={player} roomCode="8966" connectionState="connected" onCommand={vi.fn()} />
    );

    expect(container.querySelectorAll('.room-driver-grid .driver-card')).toHaveLength(4);
    expect(screen.getAllByText('待加入')).toHaveLength(3);
  });

  it('uses the compact roster density when the lobby reaches four racers', () => {
    const player: PlayerSession = {
      playerId: 'player-1',
      nickname: '车手1',
      lastRoomCode: '8966'
    };

    const room: RoomState = {
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
      players: [createRoomPlayer(1), createRoomPlayer(2), createRoomPlayer(3), createRoomPlayer(4)]
    };

    const { container } = render(
      <RoomLobbyPanel room={room} player={player} roomCode="8966" connectionState="connected" onCommand={vi.fn()} />
    );

    expect(container.querySelector('.room-driver-grid')).toHaveAttribute('data-roster-density', 'compact');
  });
});
