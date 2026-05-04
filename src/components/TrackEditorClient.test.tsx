import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TrackEditorClient } from './TrackEditorClient';

const VALID_TRACK_MAP = 'gIAFgYANgoAEgoEAgoIHgYIBgIIGgIEA';

const runtimeMock = vi.hoisted(() => {
  const handle = {
    destroy: vi.fn(),
    setTool: vi.fn(),
    clear: vi.fn(),
    setTrackMap: vi.fn(),
    getTrackMap: vi.fn(() => 'gIAFgYANgoAEgoEAgoIHgYIBgIIGgIEA')
  };

  return {
    handle,
    mountTrackEditorRuntime: vi.fn(async (_container: HTMLElement, options: { onChange?: (change: { trackMap: string; cellCount: number }) => void }) => {
      options.onChange?.({ trackMap: 'gIAFgYANgoAEgoEAgoIHgYIBgIIGgIEA', cellCount: 8 });
      return handle;
    })
  };
});

vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  )
}));

vi.mock('@/session/usePlayerSession', () => ({
  usePlayerSession: () => ({
    session: {
      playerId: 'player-1',
      nickname: 'Racer',
      lastRoomCode: null
    }
  })
}));

vi.mock('../../js/TrackEditorRuntime.js', () => ({
  mountTrackEditorRuntime: runtimeMock.mountTrackEditorRuntime
}));

describe('TrackEditorClient', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    runtimeMock.mountTrackEditorRuntime.mockClear();
    runtimeMock.handle.destroy.mockClear();
    runtimeMock.handle.setTool.mockClear();
    runtimeMock.handle.clear.mockClear();
    runtimeMock.handle.setTrackMap.mockClear();
    runtimeMock.handle.getTrackMap.mockReturnValue(VALID_TRACK_MAP);

    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response(JSON.stringify({ ok: true, tracks: [] }))))
    );
  });

  it('mounts the original 3D track editor runtime and exposes its tools through the product shell', async () => {
    render(<TrackEditorClient />);

    await waitFor(() => {
      expect(runtimeMock.mountTrackEditorRuntime).toHaveBeenCalledWith(
        expect.any(HTMLElement),
        expect.objectContaining({
          assetBaseUrl: '/racing/',
          storageKey: 'racing-track-editor-draft',
          initialTool: 'road'
        })
      );
    });

    expect(screen.getByText(/使用原生 3D 画图工具/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '擦除' }));

    expect(runtimeMock.handle.setTool).toHaveBeenCalledWith('erase');
  });

  it('keeps saved tracks behind an explicit panel trigger instead of always-on main layout', async () => {
    render(<TrackEditorClient />);

    await waitFor(() => {
      expect(runtimeMock.mountTrackEditorRuntime).toHaveBeenCalled();
    });

    expect(screen.getByRole('button', { name: '我的赛道' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '关闭' })).not.toBeInTheDocument();
  });

  it('opens the saved-track panel only when the track library trigger is pressed', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              ok: true,
              tracks: [{ id: 'track-1', name: '山路', trackMap: VALID_TRACK_MAP, cellCount: 8 }]
            })
          )
        )
      )
    );

    render(<TrackEditorClient />);

    const libraryTrigger = await screen.findByRole('button', { name: '我的赛道' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(libraryTrigger);

    expect(screen.getByRole('button', { name: '我的赛道' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('dialog', { name: '赛道列表' })).toBeInTheDocument();
    expect(await screen.findByText('山路')).toBeInTheDocument();
  });

  it('exposes compact track editor hooks so wechat landscape can collapse chrome further', async () => {
    render(<TrackEditorClient />);

    await waitFor(() => {
      expect(runtimeMock.mountTrackEditorRuntime).toHaveBeenCalled();
    });

    expect(screen.getByText('使用原生 3D 画图工具：拖拽画路、擦除改线、ghost 预览会自动拼接路块。')).toHaveClass(
      'muted',
      'track-editor-intro'
    );
    expect(screen.getByRole('link', { name: '返回大厅' })).toHaveClass('secondary-action', 'track-editor-back-link');
    expect(screen.getByRole('link', { name: '返回大厅' }).closest('section')).toHaveClass(
      'race-layout',
      'console-screen',
      'track-editor-screen'
    );
    expect(screen.getByRole('group', { name: '赛道编辑工具' }).closest('section')).toHaveClass(
      'track-editor-main-shell'
    );
  });
});
