'use client';

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import type { CommandResult, RealtimeMessage, RoomCommandEnvelope } from './protocol';
import { createMatchCommand, initialMatchSessionState, reduceMatchSession } from './matchReducer';
import { acquireRealtimeRoom, attachRealtimeHandlers, disposeRealtimeConnection, sendRealtimeCommand } from './sessionClient';
import { detachActiveListeners } from './roomConnectionStore';
import type { PlayerSession } from '@/session/playerSession';
import { resolveSessionNickname } from '@/session/playerSession';

export type MatchConnectionState = 'idle' | 'connecting' | 'connected' | 'error';
export function useMatchSession(roomCode: string, player: PlayerSession | null) {
  const [state, dispatch] = useReducer(reduceMatchSession, initialMatchSessionState);
  const [connectionState, setConnectionState] = useState<MatchConnectionState>('idle');
  const roomRef = useRef<Awaited<ReturnType<typeof acquireRealtimeRoom>> | null>(null);
  const pendingCommandRef = useRef(new Map<string, (result: CommandResult) => void>());

  useEffect(() => {
    if (!player) return;

    let cancelled = false;
    setConnectionState('connecting');

    acquireRealtimeRoom({
      roomCode,
      playerId: player.playerId,
      nickname: resolveSessionNickname(player)
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
      if (player) {
        detachActiveListeners(roomCode, player.playerId);
      }
    };
  }, [player, roomCode]);

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
    if (!player || connectionState !== 'connected') return;
    void sendCommand(createMatchCommand('match.sync', player.playerId, {}));
  }, [connectionState, player, sendCommand]);

  useEffect(() => {
    if (!player || connectionState !== 'connected' || !state.needsSync) return;
    void sendCommand(createMatchCommand('match.sync', player.playerId, {}));
  }, [connectionState, player, sendCommand, state.needsSync]);

  return {
    room: state.room,
    match: state.match,
    connectionState,
    lastErrorCode: state.lastErrorCode,
    needsSync: state.needsSync,
    sendCommand
  };
}
