'use client';

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import type { RoomCommandEnvelope, TransportMode } from './protocol';
import { createCommand, initialRoomSessionState, reduceRoomSession } from './sessionReducer';
import { openCoordinatorSocket, requestCoordinatorTicket, sendBridgeCommand, type CoordinatorTicket } from './sessionClient';
import type { PlayerSession } from '@/session/playerSession';

export type ConnectionState = 'idle' | 'connecting' | 'connected' | 'error';
const BRIDGE_SYNC_INTERVAL_MS = 5_000;

/**
 * Unifies bridge and socket access behind one room-session hook. Components send
 * commands and consume snapshots; they do not mutate local room truth directly.
 */
export function useRoomSession(roomCode: string, player: PlayerSession | null) {
  const [state, dispatch] = useReducer(reduceRoomSession, initialRoomSessionState);
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle');
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

  useEffect(() => {
    if (!player || !ticket || transportMode !== 'bridge') return;

    let cancelled = false;
    const bridgeTicket = ticket;
    const bridgePlayerId = player.playerId;

    /**
     * Room pages always keep a same-origin sync loop alive, even if ticket
     * bootstrap selected socket mode. This makes lobby state resilient when a
     * deployment still falls back to bridge or when WebSocket ingress is not
     * fully available in the current environment.
     */
    async function syncBridgeSnapshot() {
      const result = await sendBridgeCommand(roomCode, bridgeTicket, createCommand('sync.request', bridgePlayerId, {}));
      if (!cancelled) {
        dispatch(result);
      }
    }

    void syncBridgeSnapshot();
    const syncTimer = window.setInterval(() => {
      void syncBridgeSnapshot();
    }, BRIDGE_SYNC_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(syncTimer);
    };
  }, [player, roomCode, ticket, transportMode]);

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

      const result = await sendBridgeCommand(roomCode, ticket, command);
      dispatch(result);
      return result;
    },
    [roomCode, state.lastSeq, ticket, transportMode]
  );

  return {
    snapshot: state.snapshot,
    connectionState,
    lastErrorCode: state.lastErrorCode,
    needsSync: state.needsSync,
    sendCommand
  };
}
