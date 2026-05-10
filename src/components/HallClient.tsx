'use client';

import React from 'react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CreateRoomForm } from './CreateRoomForm';
import { HallRoomList } from './HallRoomList';
import { JoinRoomForm } from './JoinRoomForm';
import { createRoomReservation, joinRoomReservation } from '@/realtime/sessionClient';
import type { RacingTrackSummary } from '@/server/tracks';
import type { HallRoomSummary } from '@/server/rooms';
import { formatRacingError } from '@/realtime/errorMessages';
import { usePlayerSession } from '@/session/usePlayerSession';
import { resolveSessionNickname } from '@/session/playerSession';

const ROOM_LIST_REFRESH_INTERVAL_MS = 5_000;

export function HallClient({
  onEnterRoom,
  onOpenTrackEditor
}: {
  onEnterRoom?(code: string): void;
  onOpenTrackEditor?(): void;
} = {}) {
  const router = useRouter();
  const { session, rememberRoom, updateNickname } = usePlayerSession();
  const [rooms, setRooms] = useState<HallRoomSummary[]>([]);
  const [tracks, setTracks] = useState<RacingTrackSummary[]>([]);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [nickname, setNickname] = useState('');

  useEffect(() => {
    let cancelled = false;

    /**
     * The hall is the shared waiting-room radar. A lightweight refresh keeps
     * newly created rooms joinable without asking players to manually reload.
     */
    async function refreshRooms() {
      try {
        const response = await fetch('/api/rooms');
        const body = await response.json();

        if (!cancelled) {
          setRooms(body.rooms ?? []);
        }
      } catch {
        if (!cancelled) {
          setRooms([]);
        }
      }
    }

    void refreshRooms();
    const refreshTimer = window.setInterval(() => {
      void refreshRooms();
    }, ROOM_LIST_REFRESH_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(refreshTimer);
    };
  }, []);

  useEffect(() => {
    if (!session?.playerId) return;

    let cancelled = false;
    const playerId = session.playerId;

    async function refreshTracks() {
      try {
        const response = await fetch(`/api/tracks?playerId=${encodeURIComponent(playerId)}`);
        const body = await response.json();
        if (!cancelled) {
          setTracks(body.tracks ?? []);
        }
      } catch {
        if (!cancelled) {
          setTracks([]);
        }
      }
    }

    void refreshTracks();

    return () => {
      cancelled = true;
    };
  }, [session?.playerId]);

  useEffect(() => {
    if (session?.nickname) {
      setNickname(session.nickname);
    }
  }, [session?.nickname]);

  async function handleCreateRoom() {
    if (!session) return;
    setBusy(true);
    setErrorCode(null);

    try {
      const nicknameForCommand = resolveSessionNickname(session);
      updateNickname(nicknameForCommand);
      const selectedTrack = selectedTrackId ? tracks.find((track) => track.id === selectedTrackId) ?? null : null;
      const result = await createRoomReservation({
        playerId: session.playerId,
        nickname: nicknameForCommand,
        track: selectedTrack
      });

      rememberRoom(result.roomCode);
      if (onEnterRoom) {
        onEnterRoom(result.roomCode);
        return;
      }

      router.push(`/room/${result.roomCode}`);
    } catch (error) {
      setErrorCode(error instanceof Error ? error.message : 'COORDINATOR_NOT_READY');
    } finally {
      setBusy(false);
    }
  }

  async function handleJoinRoom(roomCode: string) {
    if (!session) return;
    setBusy(true);
    setErrorCode(null);

    try {
      const nicknameForCommand = resolveSessionNickname(session);
      updateNickname(nicknameForCommand);
      await joinRoomReservation({
        roomCode,
        playerId: session.playerId,
        nickname: nicknameForCommand
      });

      rememberRoom(roomCode.toUpperCase());
      if (onEnterRoom) {
        onEnterRoom(roomCode);
        return;
      }

      router.push(`/room/${roomCode.toUpperCase()}`);
    } catch (error) {
      setErrorCode(error instanceof Error ? error.message : 'ROOM_NOT_FOUND');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="race-layout console-screen">
      <div className="race-panel control-console stack">
        <div className="console-topline">
          <div className="console-title-group">
            <span className="panel-kicker">维修区</span>
            <strong className="console-screen-title">赛车大厅</strong>
            <p className="muted">所有操作集中在主控台内完成。</p>
          </div>
          <label className="field identity-field">
            <span>车手昵称</span>
            <input
              className="input"
              value={nickname}
              maxLength={20}
              placeholder="输入昵称"
              onChange={(event) => {
                const nextNickname = event.target.value;
                setNickname(nextNickname);
                updateNickname(nextNickname);
              }}
            />
          </label>
        </div>
        {errorCode ? <p className="error-banner">{formatRacingError(errorCode)}</p> : null}
        <div className="hall-console-grid">
          <CreateRoomForm
            player={session}
            tracks={tracks}
            selectedTrackId={selectedTrackId}
            disabled={busy}
            onSelectTrack={setSelectedTrackId}
            onCreate={handleCreateRoom}
            onOpenTrackEditor={onOpenTrackEditor}
          />
          <JoinRoomForm player={session} disabled={busy} onJoin={handleJoinRoom} />
          <HallRoomList rooms={rooms} onJoin={handleJoinRoom} />
        </div>
      </div>
    </section>
  );
}
