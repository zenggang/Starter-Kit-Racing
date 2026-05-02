'use client';

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import type { RoomCommandEnvelope, TransportMode } from './protocol';
import { createMatchCommand, initialMatchSessionState, reduceMatchSession } from './matchReducer';
import { openCoordinatorSocket, requestCoordinatorTicket, sendBridgeCommand, type CoordinatorTicket } from './sessionClient';
import type { PlayerSession } from '@/session/playerSession';

export type MatchConnectionState = 'idle' | 'connecting' | 'connected' | 'error';

const BRIDGE_SYNC_INTERVAL_MS = 5_000;

/**
 * Race and result pages consume one match session hook instead of directly
 * talking to transport APIs. This keeps bridge polling, reconnect recovery, and
 * eventual socket support behind one consistent interface.
 */
export function useMatchSession(roomCode: string, player: PlayerSession | null) {
  const [state, dispatch] = useReducer(reduceMatchSession, initialMatchSessionState);
  const [connectionState, setConnectionState] = useState<MatchConnectionState>('idle');
  const [ticket, setTicket] = useState<CoordinatorTicket | null>(null);
  const [transportMode, setTransportMode] = useState<TransportMode | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!player) return;

    let cancelled = false;
    setConnectionState('connecting');
    setTransportMode(null);

    requestCoordinatorTicket({
      playerId: player.playerId,
      nickname: player.nickname,
      roomCode
    })
      .then((nextTicket) => {
        if (cancelled) return;
        setTicket(nextTicket);
        setTransportMode(nextTicket.mode);

        if (nextTicket.mode === 'socket') {
          const socket = openCoordinatorSocket(roomCode, nextTicket, dispatch);
          socketRef.current = socket;
          socket.addEventListener('open', () => {
            if (!cancelled) {
              setConnectionState('connected');
            }
          });
          const fallbackToBridge = () => {
            if (cancelled) return;
            socketRef.current = null;
            setTransportMode('bridge');
            setConnectionState('connected');
          };
          socket.addEventListener('close', fallbackToBridge);
          socket.addEventListener('error', fallbackToBridge);
          return;
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

      if (transportMode === 'socket' && socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify(command));
        return {
          type: 'command.result' as const,
          seq: state.lastSeq,
          ok: true,
          commandId: command.commandId
        };
      }

      if (transportMode === 'bridge' || ticket.mode === 'bridge') {
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
    [roomCode, state.lastSeq, ticket, transportMode]
  );

  useEffect(() => {
    if (!player || !ticket || connectionState !== 'connected') return;

    void sendCommand(createMatchCommand('match.join', player.playerId, {}));
  }, [connectionState, player, sendCommand, ticket]);

  useEffect(() => {
    if (!player || !ticket || transportMode !== 'bridge') return;

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
  }, [player, roomCode, ticket, transportMode]);

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
