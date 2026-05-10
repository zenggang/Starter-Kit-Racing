import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HallClient } from './HallClient';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn()
  })
}));

vi.mock('@/session/usePlayerSession', () => ({
  usePlayerSession: () => ({
    session: {
      playerId: 'player-1',
      nickname: 'Racer',
      lastRoomCode: null
    },
    rememberRoom: vi.fn(),
    updateNickname: vi.fn()
  })
}));

vi.mock('@/realtime/sessionClient', () => ({
  requestCoordinatorTicket: vi.fn(),
  sendBridgeCommand: vi.fn()
}));

describe('HallClient room list refresh', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('refreshes waiting rooms so newly created rooms appear in the hall without manual reload', async () => {
    let roomCalls = 0;
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = input.toString();
      if (url.includes('/api/tracks')) {
        return Promise.resolve(new Response(JSON.stringify({ tracks: [] })));
      }

      roomCalls += 1;
      return Promise.resolve(
        new Response(
          JSON.stringify({
            rooms:
              roomCalls === 1
                ? []
                : [
                    {
                      code: '1234',
                      lapTarget: 3,
                      trackName: null,
                      playerCount: 1,
                      expiresAt: '2026-05-02T00:10:00.000Z'
                    }
                  ]
          })
        )
      );
    });

    vi.stubGlobal('fetch', fetchMock);

    render(<HallClient />);

    const editorEntry = screen.getByRole('link', { name: '创建/管理赛道' });
    expect(editorEntry).toHaveAttribute('href', '/track-editor');

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText('暂无等待中的房间')).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText('1234')).toBeInTheDocument();
    expect(screen.getByText('1 名车手')).toBeInTheDocument();
  });
});
