'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { validateTrackMap } from '../../shared/trackMapValidation';
import { formatRacingError } from '@/realtime/errorMessages';
import type { RacingTrackSummary } from '@/server/tracks';
import { usePlayerSession } from '@/session/usePlayerSession';

type Tool = 'road' | 'erase';

interface TrackEditorChange {
  trackMap: string;
  cellCount: number;
}

interface TrackEditorRuntimeHandle {
  destroy(): void;
  setTool(tool: Tool): void;
  clear(): void;
  setTrackMap(trackMap: string | null): void;
  getTrackMap(): string | null;
}

interface TrackEditorRuntimeModule {
  mountTrackEditorRuntime(
    container: HTMLElement,
    options: {
      assetBaseUrl?: string;
      storageKey?: string;
      initialTool?: Tool;
      initialTrackMap?: string | null;
      onChange?(change: TrackEditorChange): void;
    }
  ): Promise<TrackEditorRuntimeHandle>;
}

const EDITOR_DRAFT_STORAGE_KEY = 'racing-track-editor-draft';

export function TrackEditorClient({ onBackToHall }: { onBackToHall?(): void } = {}) {
  const { session } = usePlayerSession();
  const runtimeHostRef = useRef<HTMLDivElement | null>(null);
  const runtimeRef = useRef<TrackEditorRuntimeHandle | null>(null);
  const [name, setName] = useState('我的赛道');
  const [tool, setTool] = useState<Tool>('road');
  const [trackMap, setTrackMap] = useState<string | null>(null);
  const [cellCount, setCellCount] = useState(0);
  const [tracks, setTracks] = useState<RacingTrackSummary[]>([]);
  const [editingTrackId, setEditingTrackId] = useState<string | null>(null);
  const [isTrackLibraryOpen, setIsTrackLibraryOpen] = useState(false);
  const [runtimeReady, setRuntimeReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const validation = useMemo(() => validateTrackMap(trackMap), [trackMap]);

  useEffect(() => {
    let runtime: TrackEditorRuntimeHandle | null = null;
    let cancelled = false;

    async function mountRuntime() {
      if (!runtimeHostRef.current) return;

      const mod = (await import('../../js/TrackEditorRuntime.js')) as TrackEditorRuntimeModule;
      runtime = await mod.mountTrackEditorRuntime(runtimeHostRef.current, {
        assetBaseUrl: '/racing/',
        storageKey: EDITOR_DRAFT_STORAGE_KEY,
        initialTool: 'road',
        onChange(change) {
          setTrackMap(change.trackMap);
          setCellCount(change.cellCount);
          setMessage(null);
        }
      });

      if (cancelled) {
        runtime.destroy();
        runtime = null;
        return;
      }

      runtimeRef.current = runtime;
      setRuntimeReady(true);
    }

    void mountRuntime();

    return () => {
      cancelled = true;
      setRuntimeReady(false);
      runtimeRef.current = null;
      runtime?.destroy();
    };
  }, []);

  useEffect(() => {
    runtimeRef.current?.setTool(tool);
  }, [tool]);

  useEffect(() => {
    if (!session?.playerId) return;
    void refreshTracks(session.playerId);
  }, [session?.playerId]);

  useEffect(() => {
    if (!isTrackLibraryOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsTrackLibraryOpen(false);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isTrackLibraryOpen]);

  async function refreshTracks(playerId: string) {
    const response = await fetch(`/api/tracks?playerId=${encodeURIComponent(playerId)}`);
    const body = await response.json();
    setTracks(body.tracks ?? []);
  }

  async function saveTrack() {
    const runtimeTrackMap = runtimeRef.current?.getTrackMap() ?? trackMap;
    const runtimeValidation = validateTrackMap(runtimeTrackMap);

    if (!session || !runtimeValidation.ok) {
      setMessage(runtimeValidation.ok ? null : formatRacingError(runtimeValidation.errors[0]) ?? runtimeValidation.errors[0]);
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      const response = await fetch(editingTrackId ? `/api/tracks/${editingTrackId}` : '/api/tracks', {
        method: editingTrackId ? 'PATCH' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          playerId: session.playerId,
          name,
          trackMap: runtimeValidation.normalizedTrackMap
        })
      });
      const body = await response.json();

      if (!body.ok) {
        setMessage(formatRacingError(body.errorCode) ?? body.errorCode);
        return;
      }

      setEditingTrackId(body.track.id);
      setMessage('赛道已保存，回到大厅后可以在建房下拉框里选择。');
      await refreshTracks(session.playerId);
    } finally {
      setBusy(false);
    }
  }

  async function deleteTrack(trackId: string) {
    if (!session) return;
    setBusy(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/tracks/${trackId}?playerId=${encodeURIComponent(session.playerId)}`, { method: 'DELETE' });
      const body = await response.json();
      if (!body.ok) {
        setMessage(formatRacingError(body.errorCode) ?? body.errorCode);
        return;
      }

      if (editingTrackId === trackId) {
        resetEditor();
      }
      await refreshTracks(session.playerId);
    } finally {
      setBusy(false);
    }
  }

  function loadTrack(track: RacingTrackSummary) {
    setName(track.name);
    setEditingTrackId(track.id);
    runtimeRef.current?.setTrackMap(track.trackMap);
    setTrackMap(track.trackMap);
    setCellCount(track.cellCount);
    setMessage(null);
    setIsTrackLibraryOpen(false);
  }

  function resetEditor() {
    setName('我的赛道');
    setEditingTrackId(null);
    setTool('road');
    runtimeRef.current?.clear();
    setMessage(null);
  }

  function openTrackLibrary() {
    setIsTrackLibraryOpen(true);
  }

  function closeTrackLibrary() {
    setIsTrackLibraryOpen(false);
  }

  return (
    <section className="race-layout console-screen track-editor-screen">
      <div className="race-panel track-editor-console track-editor-console-shell stack">
        <div className="console-topline">
          <div className="console-title-group">
            <span className="panel-kicker">赛道工坊</span>
            <strong className="console-screen-title">自定义赛道</strong>
            <p className="muted track-editor-intro">使用原生 3D 画图工具：拖拽画路、擦除改线、ghost 预览会自动拼接路块。</p>
          </div>
          {onBackToHall ? (
            <button type="button" className="secondary-action track-editor-back-link" onClick={onBackToHall}>
              返回大厅
            </button>
          ) : (
            <Link href="/hall" className="secondary-action track-editor-back-link">
              返回大厅
            </Link>
          )}
        </div>

        <div className="track-editor-grid">
          <section className="console-section track-editor-main track-editor-main-shell">
            <div className="track-editor-mobile-rail track-editor-tool-rail">
              <div className="track-editor-tool-group" role="group" aria-label="赛道编辑工具">
                <button
                  type="button"
                  className={tool === 'road' ? 'track-editor-tool-button track-editor-tool-button-active' : 'track-editor-tool-button'}
                  onClick={() => setTool('road')}
                >
                  画路
                </button>
                <button
                  type="button"
                  className={tool === 'erase' ? 'track-editor-tool-button track-editor-tool-button-active' : 'track-editor-tool-button'}
                  onClick={() => setTool('erase')}
                >
                  擦除
                </button>
                <button type="button" className="track-editor-tool-button" onClick={resetEditor}>
                  新建
                </button>
                <button
                  type="button"
                  className="track-editor-tool-button track-editor-panel-button"
                  onClick={openTrackLibrary}
                  aria-expanded={isTrackLibraryOpen}
                  aria-controls="track-editor-library-panel"
                >
                  我的赛道
                </button>
              </div>
            </div>

            <div className="track-editor-stage-console">
              <div className="track-editor-stage-shell">
                {!runtimeReady ? <p className="track-editor-loading">正在加载原生编辑器...</p> : null}
                <div ref={runtimeHostRef} className="track-editor-stage" aria-label="原生赛道编辑器" />
              </div>
            </div>

            <div className="track-editor-mobile-rail track-editor-status-rail">
              <label className="field track-editor-name-field">
                <span>赛道名称</span>
                <input className="input track-editor-name-input" value={name} maxLength={40} onChange={(event) => setName(event.target.value)} />
              </label>

              <p className={validation.ok ? 'track-editor-status-copy' : 'error-banner track-editor-status-copy'}>
                {validation.ok ? `${cellCount} 个路块 · 可保存` : formatRacingError(validation.errors[0])}
              </p>

              <div className="track-editor-hint track-editor-hint-compact">
                <span>单指画路 / 擦除</span>
                <span>双指拖拽缩放</span>
                <span>点终点切方向</span>
              </div>

              <button
                type="button"
                className="primary-action track-editor-save-button"
                disabled={busy || !session || !runtimeReady || !validation.ok}
                onClick={saveTrack}
              >
                保存赛道
              </button>

              {message ? <p className="muted track-editor-message">{message}</p> : null}
            </div>
          </section>
        </div>

        {isTrackLibraryOpen ? (
          <div className="track-editor-library-backdrop" onClick={closeTrackLibrary}>
            <aside
              id="track-editor-library-panel"
              role="dialog"
              aria-modal="true"
              aria-labelledby="track-editor-library-title"
              className="console-room-list stack track-editor-library is-open"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="console-section-head track-editor-library-head">
                <div className="track-editor-library-title">
                  <span className="panel-kicker">我的赛道</span>
                  <strong id="track-editor-library-title" className="console-block-title">
                    赛道列表
                  </strong>
                </div>
                <button type="button" className="track-editor-tool-button track-editor-library-close" onClick={closeTrackLibrary}>
                  关闭
                </button>
              </div>

              {tracks.length === 0 ? <p className="muted track-editor-library-empty">还没有保存过自定义赛道。</p> : null}

              {tracks.map((track) => (
                <div key={track.id} className="track-editor-library-item">
                  <div className="track-editor-library-item-copy">
                    <strong>{track.name}</strong>
                    <span>{track.cellCount} 格</span>
                  </div>
                  <div className="track-editor-library-item-actions">
                    <button type="button" className="secondary-action" onClick={() => loadTrack(track)}>
                      编辑
                    </button>
                    <button type="button" className="secondary-action" disabled={busy} onClick={() => deleteTrack(track.id)}>
                      删除
                    </button>
                  </div>
                </div>
              ))}
            </aside>
          </div>
        ) : null}
      </div>
    </section>
  );
}
