'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { RoomLobbyPanel } from './RoomLobbyPanel';
import { useRoomSession } from '@/realtime/useRoomSession';
import { formatRacingError } from '@/realtime/errorMessages';
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

    if (snapshot?.status === 'finished') {
      router.push(`/result/${snapshot.code}`);
    }
  }, [router, snapshot]);

  return (
    <section className="race-layout">
      <div className="race-page-head">
        <p className="eyebrow">发车格</p>
        <h1>房间 {code}</h1>
        <p className="muted">连接状态：{connectionState === 'connected' ? '已连接' : '连接中'}</p>
      </div>
      {lastErrorCode ? <p className="error-banner">{formatRacingError(lastErrorCode)}</p> : null}
      <RoomLobbyPanel room={snapshot} player={session} disabled={connectionState !== 'connected'} onCommand={sendCommand} />
    </section>
  );
}
