'use client';

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import type { CommandResult, RealtimeMessage, RoomCommandEnvelope } from './protocol';
import { createCommand, initialRoomSessionState, reduceRoomSession } from './sessionReducer';
import { acquireRealtimeRoom, attachRealtimeHandlers, disposeRealtimeConnection, sendRealtimeCommand } from './sessionClient';
import { detachActiveListeners } from './roomConnectionStore';
import type { PlayerSession } from '@/session/playerSession';
import { resolveSessionNickname } from '@/session/playerSession';

export type ConnectionState = 'idle' | 'connecting' | 'connected' | 'error';

export function useRoomSession(roomCode: string, player: PlayerSession | null) {
  const [state, dispatch] = useReducer(reduceRoomSession, initialRoomSessionState);
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle');
  const roomRef = useRef<Awaited<ReturnType<typeof acquireRealtimeRoom>> | null>(null);
  const pendingCommandRef = useRef(new Map<string, (result: CommandResult) => void>());
  const playerId = player?.playerId ?? null;
  const playerNickname = player ? resolveSessionNickname(player) : null;

  useEffect(() => {
    if (!playerId || !playerNickname) return;

    let cancelled = false;
    setConnectionState('connecting');

    acquireRealtimeRoom({
      roomCode,
      playerId,
      nickname: playerNickname
    })
      .then((room) => {
        if (cancelled) return;
        roomRef.current = room;
        attachRealtimeHandlers(
          room,
          (message: RealtimeMessage) => {
            dispatch(message);
            if (message.type === 'command.result' && message.commandId) {
              const resolvePending = pendingCommandRef.current.get(message.commandId);
              if (resolvePending) {
                pendingCommandRef.current.delete(message.commandId);
                resolvePending(message);
              }
            }
          },
          () => setConnectionState('error'),
          () => setConnectionState('error')
        );
        setConnectionState('connected');
      })
      .catch(() => {
        if (!cancelled) setConnectionState('error');
      });

    return () => {
      cancelled = true;
      if (playerId) {
        detachActiveListeners(roomCode, playerId);
      }
    };
  }, [playerId, playerNickname, roomCode]);

  const sendCommand = useCallback(
    async (command: RoomCommandEnvelope) => {
      const room = roomRef.current;
      if (!room) {
        return {
          type: 'command.result' as const,
          seq: 0,
          ok: false,
          commandId: command.commandId,
          errorCode: 'COORDINATOR_NOT_READY' as const
        };
      }

      const result = await new Promise<CommandResult>((resolve) => {
        pendingCommandRef.current.set(command.commandId, resolve);
        sendRealtimeCommand(room, command);
      });

      if (command.type === 'room.leave' && result.ok) {
        await disposeRealtimeConnection();
      }

      return result;
    },
    []
  );

  useEffect(() => {
    if (!playerId || connectionState !== 'connected') return;
    void sendCommand(createCommand('sync.request', playerId, {}));
  }, [connectionState, playerId, sendCommand]);

  useEffect(() => {
    if (!playerId || connectionState !== 'connected' || !state.needsSync) return;
    void sendCommand(createCommand('sync.request', playerId, {}));
  }, [connectionState, playerId, sendCommand, state.needsSync]);

  return {
    snapshot: state.snapshot,
    connectionState,
    lastErrorCode: state.lastErrorCode,
    needsSync: state.needsSync,
    sendCommand
  };
}
