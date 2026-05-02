'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CreateRoomForm } from './CreateRoomForm';
import { HallRoomList } from './HallRoomList';
import { JoinRoomForm } from './JoinRoomForm';
import { requestCoordinatorTicket, sendBridgeCommand } from '@/realtime/sessionClient';
import type { HallRoomSummary } from '@/server/rooms';
import { createCommand } from '@/realtime/sessionReducer';
import { formatRacingError } from '@/realtime/errorMessages';
import { usePlayerSession } from '@/session/usePlayerSession';

export function HallClient() {
  const router = useRouter();
  const { session, rememberRoom, updateNickname } = usePlayerSession();
  const [rooms, setRooms] = useState<HallRoomSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [nickname, setNickname] = useState('');

  useEffect(() => {
    fetch('/api/rooms')
      .then((response) => response.json())
      .then((body) => setRooms(body.rooms ?? []))
      .catch(() => setRooms([]));
  }, []);

  useEffect(() => {
    if (session?.nickname) {
      setNickname(session.nickname);
    }
  }, [session?.nickname]);

  async function sendHallCommand(roomCode: string, command: ReturnType<typeof createCommand>) {
    if (!session) return;
    setBusy(true);
    setErrorCode(null);

    try {
      const ticket = await requestCoordinatorTicket({ playerId: session.playerId, nickname: session.nickname, roomCode });
      const result = await sendBridgeCommand(roomCode, ticket, command);

      if (!result.ok || !result.room) {
        setErrorCode(result.errorCode ?? 'COORDINATOR_NOT_READY');
        return;
      }

      rememberRoom(result.room.code);
      router.push(`/room/${result.room.code}`);
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
        <div className="console-action-grid">
          <CreateRoomForm player={session} disabled={busy} onCreate={(command) => sendHallCommand('new', command)} />
          <JoinRoomForm player={session} disabled={busy} onJoin={sendHallCommand} />
        </div>
        <HallRoomList rooms={rooms} onJoin={(code) => session && sendHallCommand(code, createCommand('room.join', session.playerId))} />
      </div>
    </section>
  );
}
