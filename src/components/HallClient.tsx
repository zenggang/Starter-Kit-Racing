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
  const { session, rememberRoom } = usePlayerSession();
  const [rooms, setRooms] = useState<HallRoomSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/rooms')
      .then((response) => response.json())
      .then((body) => setRooms(body.rooms ?? []))
      .catch(() => setRooms([]));
  }, []);

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
    <section className="race-layout">
      <div className="race-page-head">
        <p className="eyebrow">维修区</p>
        <h1>赛车大厅</h1>
        <p className="muted">创建房间、输入房间码，或加入正在等候的比赛。</p>
      </div>
      {errorCode ? <p className="error-banner">{formatRacingError(errorCode)}</p> : null}
      <div className="hall-grid">
        <CreateRoomForm player={session} disabled={busy} onCreate={(command) => sendHallCommand('new', command)} />
        <JoinRoomForm player={session} disabled={busy} onJoin={sendHallCommand} />
      </div>
      <HallRoomList rooms={rooms} onJoin={(code) => session && sendHallCommand(code, createCommand('room.join', session.playerId))} />
    </section>
  );
}
