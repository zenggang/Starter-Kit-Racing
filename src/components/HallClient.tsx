'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CreateRoomForm } from './CreateRoomForm';
import { HallRoomList } from './HallRoomList';
import { JoinRoomForm } from './JoinRoomForm';
import { requestCoordinatorTicket, sendBridgeCommand } from '@/realtime/sessionClient';
import type { HallRoomSummary } from '@/server/rooms';
import { createCommand } from '@/realtime/sessionReducer';
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
    <section className="stack">
      <div>
        <h1>Hall</h1>
        <p className="muted">Create or join a room from a phone-friendly lobby.</p>
      </div>
      {errorCode ? <p className="error">{errorCode}</p> : null}
      <CreateRoomForm player={session} disabled={busy} onCreate={(command) => sendHallCommand('new', command)} />
      <JoinRoomForm player={session} disabled={busy} onJoin={sendHallCommand} />
      <HallRoomList rooms={rooms} onJoin={(code) => session && sendHallCommand(code, createCommand('room.join', session.playerId))} />
    </section>
  );
}
