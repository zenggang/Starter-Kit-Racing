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
  const currentPlayer = snapshot?.players.find((candidate) => candidate.playerId === session?.playerId) ?? null;

  useEffect(() => {
    if (!session || connectionState !== 'connected' || joinedRef.current) return;
    joinedRef.current = true;
    rememberRoom(code);
    void sendCommand(createCommand('room.join', session.playerId));
  }, [code, connectionState, rememberRoom, sendCommand, session]);

  useEffect(() => {
    if (snapshot?.status === 'racing' && currentPlayer?.ready && currentPlayer?.color) {
      router.push(`/race/${snapshot.code}`);
    }

    if (snapshot?.status === 'finished' && currentPlayer) {
      router.push(`/result/${snapshot.code}`);
    }
  }, [currentPlayer, router, snapshot]);

  return (
    <section className="race-layout">
      <div className="race-page-head">
        <p className="eyebrow">发车格</p>
        <h1>
          房间 <span className="room-code-head">{code}</span>
        </h1>
        <p className="muted">连接状态：{connectionState === 'connected' ? '已连接' : '连接中'}</p>
      </div>
      {lastErrorCode ? <p className="error-banner">{formatRacingError(lastErrorCode)}</p> : null}
      <RoomLobbyPanel room={snapshot} player={session} disabled={connectionState !== 'connected'} onCommand={sendCommand} />
    </section>
  );
}
