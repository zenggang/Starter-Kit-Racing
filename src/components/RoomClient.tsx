'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { RoomLobbyPanel } from './RoomLobbyPanel';
import { useRoomSession } from '@/realtime/useRoomSession';
import { createCommand } from '@/realtime/sessionReducer';
import { usePlayerSession } from '@/session/usePlayerSession';

export function RoomClient({ code }: { code: string }) {
  const router = useRouter();
  const { session, rememberRoom } = usePlayerSession();
  const { snapshot, connectionState, lastErrorCode, sendCommand } = useRoomSession(code, session);
  const joinedRef = useRef(false);

  useEffect(() => {
    if (!session || connectionState !== 'connected' || joinedRef.current) return;
    joinedRef.current = true;
    rememberRoom(code);
    void sendCommand(createCommand('room.join', session.playerId));
  }, [code, connectionState, rememberRoom, sendCommand, session]);

  useEffect(() => {
    if (snapshot?.status === 'racing') {
      router.push(`/race/${snapshot.code}`);
    }
  }, [router, snapshot]);

  return (
    <section className="stack">
      <div>
        <h1>Room {code}</h1>
        <p className="muted">Connection: {connectionState}</p>
      </div>
      {lastErrorCode ? <p className="error">{lastErrorCode}</p> : null}
      <RoomLobbyPanel room={snapshot} player={session} disabled={connectionState !== 'connected'} onCommand={sendCommand} />
    </section>
  );
}
