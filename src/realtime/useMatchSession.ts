'use client';

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import type { RoomCommandEnvelope } from './protocol';
import { createMatchCommand, initialMatchSessionState, reduceMatchSession } from './matchReducer';
import { openCoordinatorSocket, requestCoordinatorTicket, sendBridgeCommand, type CoordinatorTicket } from './sessionClient';
import type { PlayerSession } from '@/session/playerSession';

export type MatchConnectionState = 'idle' | 'connecting' | 'connected' | 'error';

const BRIDGE_SYNC_INTERVAL_MS = 1_500;

/**
 * Race and result pages consume one match session hook instead of directly
 * talking to transport APIs. This keeps bridge polling, reconnect recovery, and
 * eventual socket support behind one consistent interface.
 */
export function useMatchSession(roomCode: string, player: PlayerSession | null) {
  const [state, dispatch] = useReducer(reduceMatchSession, initialMatchSessionState);
  const [connectionState, setConnectionState] = useState<MatchConnectionState>('idle');
  const [ticket, setTicket] = useState<CoordinatorTicket | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!player) return;

    let cancelled = false;
    setConnectionState('connecting');

    requestCoordinatorTicket({
      playerId: player.playerId,
      nickname: player.nickname,
      roomCode
    })
      .then((nextTicket) => {
        if (cancelled) return;
        setTicket(nextTicket);

        if (nextTicket.mode === 'socket') {
          socketRef.current = openCoordinatorSocket(nextTicket, dispatch);
        }

        setConnectionState('connected');
      })
      .catch(() => {
        if (!cancelled) setConnectionState('error');
      });

    return () => {
      cancelled = true;
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [player, roomCode]);

  const sendCommand = useCallback(
    async (command: RoomCommandEnvelope) => {
      if (!ticket) {
        return {
          type: 'command.result' as const,
          seq: 0,
          ok: false,
          commandId: command.commandId,
          errorCode: 'COORDINATOR_NOT_READY' as const
        };
      }

      if (ticket.mode === 'bridge') {
        const result = await sendBridgeCommand(roomCode, ticket, command);
        dispatch(result);
        return result;
      }

      socketRef.current?.send(JSON.stringify(command));
      return {
        type: 'command.result' as const,
        seq: state.lastSeq,
        ok: true,
        commandId: command.commandId
      };
    },
    [roomCode, state.lastSeq, ticket]
  );

  useEffect(() => {
    if (!player || !ticket || connectionState !== 'connected') return;

    void sendCommand(createMatchCommand('match.join', player.playerId, {}));
  }, [connectionState, player, sendCommand, ticket]);

  useEffect(() => {
    if (!player || !ticket || ticket.mode !== 'bridge') return;

    let cancelled = false;
    const bridgeTicket = ticket;
    const bridgePlayerId = player.playerId;

    async function syncMatchSnapshot() {
      const result = await sendBridgeCommand(roomCode, bridgeTicket, createMatchCommand('match.sync', bridgePlayerId, {}));
      if (!cancelled) {
        dispatch(result);
      }
    }

    void syncMatchSnapshot();
    const syncTimer = window.setInterval(() => {
      void syncMatchSnapshot();
    }, BRIDGE_SYNC_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(syncTimer);
    };
  }, [player, roomCode, ticket]);

  useEffect(() => {
    if (!state.needsSync || !player || !ticket) return;
    void sendCommand(createMatchCommand('match.sync', player.playerId, {}));
  }, [player, sendCommand, state.needsSync, ticket]);

  return {
    room: state.room,
    match: state.match,
    connectionState,
    lastErrorCode: state.lastErrorCode,
    needsSync: state.needsSync,
    sendCommand
  };
}
