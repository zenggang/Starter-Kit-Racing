import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RoomLobbyPanel } from './RoomLobbyPanel';
import type { RoomState } from '@/realtime/protocol';
import type { PlayerSession } from '@/session/playerSession';

vi.mock('next/link', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

vi.mock('./ColorPicker', () => ({
  PLAYER_COLOR_HEX: {
    yellow: '#f4c430',
    green: '#52c46b',
    purple: '#9b6ef3',
    red: '#ef5350'
  },
  PLAYER_COLOR_LABELS: {
    yellow: '黄色赛车',
    green: '绿色赛车',
    purple: '紫色赛车',
    red: '红色赛车'
  },
  ColorPicker: ({ selected, taken, compact, label }: { selected: string | null; taken: string[]; compact?: boolean; label?: string }) => (
    <div data-testid="color-picker" data-selected={selected ?? ''} data-taken={taken.join(',')} data-compact={compact ? 'true' : 'false'}>
      {label ? <span>{label}</span> : null}
    </div>
  )
}));

vi.mock('./LapTargetControl', () => ({
  LapTargetControl: ({ value }: { value: number }) => <div data-testid="lap-target-control">{value} 圈</div>
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
  afterEach(() => {
    cleanup();
  });

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
      <RoomLobbyPanel room={room} player={player} roomCode="8966" connectionState="connected" onCommand={vi.fn()} onLeave={vi.fn()} />
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
      <RoomLobbyPanel room={room} player={player} roomCode="8966" connectionState="connected" onCommand={vi.fn()} onLeave={vi.fn()} />
    );

    expect(container.querySelector('.room-driver-grid')).toHaveAttribute('data-roster-density', 'compact');
  });

  it('renders the compact landscape room composition with inline color switching and track preview', () => {
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
      trackName: '默认赛道',
      trackMap: null,
      createdAt: '2026-05-02T10:00:00.000Z',
      startedAt: null,
      finishedAt: null,
      expiresAt: '2026-05-02T11:00:00.000Z',
      closedReason: null,
      matchId: null,
      players: [createRoomPlayer(1), createRoomPlayer(2, { color: null, ready: false, status: 'joined' })]
    };

    const { container } = render(
      <RoomLobbyPanel room={room} player={player} roomCode="8966" connectionState="connected" onCommand={vi.fn()} onLeave={vi.fn()} />
    );

    expect(container.querySelector('.room-lobby-layout')).not.toBeNull();
    expect(container.querySelector('.room-lobby-main')).not.toBeNull();
    expect(container.querySelector('.room-lobby-sidebar')).not.toBeNull();
    expect(container.querySelector('.room-roster-head')).not.toBeNull();
    expect(container.querySelector('.room-track-preview')).not.toBeNull();
    expect(screen.getByTestId('color-picker')).toHaveAttribute('data-compact', 'true');
    expect(screen.getByTestId('color-picker')).toHaveAttribute('data-selected', 'yellow');
    expect(screen.getByTestId('lap-target-control')).toHaveTextContent('3 圈');
    expect(screen.getByText('车身颜色')).toBeInTheDocument();
    expect(screen.getByText('比赛圈数')).toBeInTheDocument();
    expect(screen.queryByText('发车操作')).toBeNull();
    expect(screen.queryByText('未选赛车')).toBeNull();
  });

  it('renders an explicit leave-room action for the current racer', () => {
    const onLeave = vi.fn();
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

    render(
      <RoomLobbyPanel room={room} player={player} roomCode="8966" connectionState="connected" onCommand={vi.fn()} onLeave={onLeave} />
    );

    fireEvent.click(screen.getByRole('button', { name: '退出' }));

    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  it('keeps the start button disabled until every racer in the room is ready', () => {
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
      players: [createRoomPlayer(1, { ready: true, status: 'ready' }), createRoomPlayer(2, { ready: false, status: 'joined' })]
    };

    render(
      <RoomLobbyPanel room={room} player={player} roomCode="8966" connectionState="connected" onCommand={vi.fn()} onLeave={vi.fn()} />
    );

    expect(screen.getByRole('button', { name: '发车' })).toBeDisabled();
  });
});
