'use client';

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import type { RoomCommandEnvelope, TransportMode } from './protocol';
import { createMatchCommand, initialMatchSessionState, reduceMatchSession } from './matchReducer';
import { openCoordinatorSocket, requestCoordinatorTicket, sendBridgeCommand, type CoordinatorTicket } from './sessionClient';
import type { PlayerSession } from '@/session/playerSession';
import { resolveSessionNickname } from '@/session/playerSession';

export type MatchConnectionState = 'idle' | 'connecting' | 'connected' | 'error';

const BRIDGE_SYNC_INTERVAL_MS = 5_000;
const SOCKET_CONNECT_TIMEOUT_MS = 3_000;
const SOCKET_RETRY_INTERVAL_MS = 5_000;

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
  const ticketRef = useRef<CoordinatorTicket | null>(null);
  const transportModeRef = useRef<TransportMode | null>(null);
  const lastSeqRef = useRef(0);
  const joinedMatchKeyRef = useRef<string | null>(null);

  useEffect(() => {
    ticketRef.current = ticket;
  }, [ticket]);

  useEffect(() => {
    transportModeRef.current = transportMode;
  }, [transportMode]);

  useEffect(() => {
    lastSeqRef.current = state.lastSeq;
  }, [state.lastSeq]);

  useEffect(() => {
    joinedMatchKeyRef.current = null;
  }, [roomCode, player?.playerId]);

  useEffect(() => {
    if (!player) return;

    let cancelled = false;
    let socketConnectTimer = 0;
    setConnectionState('connecting');
    setTransportMode(null);

    requestCoordinatorTicket({
      playerId: player.playerId,
      nickname: resolveSessionNickname(player),
      roomCode
    })
      .then((nextTicket) => {
        if (cancelled) return;
        setTicket(nextTicket);
        transportModeRef.current = nextTicket.mode;
        setTransportMode(nextTicket.mode);

        if (nextTicket.mode === 'socket') {
          const socket = openCoordinatorSocket(roomCode, nextTicket, dispatch);
          socketRef.current = socket;
          const fallbackToBridge = () => {
            if (cancelled || socketRef.current !== socket) return;
            window.clearTimeout(socketConnectTimer);
            socketRef.current = null;
            try {
              socket.close();
            } catch {
              // Ignore close races; the hook is already switching to bridge.
            }
            transportModeRef.current = 'bridge';
            setTransportMode('bridge');
            setConnectionState('connected');
          };
          socket.addEventListener('open', () => {
            if (cancelled || socketRef.current !== socket) {
              try {
                socket.close();
              } catch {
                // Ignore late open events from sockets we already abandoned.
              }
              return;
            }

            window.clearTimeout(socketConnectTimer);
            transportModeRef.current = 'socket';
            setConnectionState('connected');
          });
          socket.addEventListener('close', fallbackToBridge);
          socket.addEventListener('error', fallbackToBridge);
          socketConnectTimer = window.setTimeout(fallbackToBridge, SOCKET_CONNECT_TIMEOUT_MS);
          return;
        }

        setConnectionState('connected');
      })
      .catch(() => {
        if (!cancelled) setConnectionState('error');
      });

    return () => {
      cancelled = true;
      window.clearTimeout(socketConnectTimer);
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [player, roomCode]);

  const sendCommand = useCallback(
    async (command: RoomCommandEnvelope) => {
      const activeTicket = ticketRef.current;
      const activeTransportMode = transportModeRef.current;

      if (!activeTicket) {
        return {
          type: 'command.result' as const,
          seq: 0,
          ok: false,
          commandId: command.commandId,
          errorCode: 'COORDINATOR_NOT_READY' as const
        };
      }

      const activeSocket = socketRef.current;
      const socketReady = activeTransportMode === 'socket' && activeSocket?.readyState === WebSocket.OPEN;
      const shouldUseSocket = socketReady && command.type === 'match.progress';

      if (shouldUseSocket) {
        activeSocket.send(JSON.stringify(command));
        return {
          type: 'command.result' as const,
          seq: lastSeqRef.current,
          ok: true,
          commandId: command.commandId
        };
      }

      const result = await sendBridgeCommand(roomCode, activeTicket, command);
      dispatch(result);
      return result;
    },
    [roomCode]
  );

  useEffect(() => {
    if (!player || !ticket || connectionState !== 'connected') return;

    const joinKey = `${roomCode}:${ticket.token}:${player.playerId}`;

    if (joinedMatchKeyRef.current === joinKey) {
      return;
    }

    joinedMatchKeyRef.current = joinKey;
    let cancelled = false;

    void sendCommand(createMatchCommand('match.join', player.playerId, {})).then((result) => {
      if (!cancelled && !result.ok && joinedMatchKeyRef.current === joinKey) {
        joinedMatchKeyRef.current = null;
      }
    });

    return () => {
      cancelled = true;
    };
  }, [connectionState, player, roomCode, sendCommand, ticket]);

  useEffect(() => {
    if (!player || !ticket || connectionState !== 'connected') return;

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
  }, [connectionState, player, roomCode, ticket]);

  useEffect(() => {
    if (!player || !ticket || ticket.mode !== 'socket' || transportMode !== 'bridge') return;

    let cancelled = false;
    let retryTimer = 0;
    let connectTimeout = 0;
    let probeSocket: WebSocket | null = null;
    const socketTicket = ticket;

    function openSocketProbe() {
      if (cancelled || socketRef.current) return;

      const socket = openCoordinatorSocket(roomCode, socketTicket, dispatch);
      let settled = false;
      probeSocket = socket;
      socketRef.current = socket;

      const scheduleRetry = () => {
        if (cancelled || settled) return;
        settled = true;
        window.clearTimeout(connectTimeout);
        if (socketRef.current === socket) {
          socketRef.current = null;
        }
        if (probeSocket === socket) {
          probeSocket = null;
        }
        retryTimer = window.setTimeout(() => {
          openSocketProbe();
        }, SOCKET_RETRY_INTERVAL_MS);
      };

      socket.addEventListener('open', () => {
        if (cancelled || socketRef.current !== socket) {
          try {
            socket.close();
          } catch {
            // Ignore close races while the hook is shutting down or swapping probes.
          }
          return;
        }

        window.clearTimeout(connectTimeout);
        window.clearTimeout(retryTimer);
        settled = true;
        if (probeSocket === socket) {
          probeSocket = null;
        }
        transportModeRef.current = 'socket';
        setTransportMode('socket');
        setConnectionState('connected');
      });

      socket.addEventListener('close', scheduleRetry);
      socket.addEventListener('error', scheduleRetry);
      connectTimeout = window.setTimeout(() => {
        try {
          socket.close();
        } catch {
          // Ignore close races; the retry scheduler handles the next probe.
        }
        scheduleRetry();
      }, SOCKET_CONNECT_TIMEOUT_MS);
    }

    retryTimer = window.setTimeout(() => {
      openSocketProbe();
    }, SOCKET_RETRY_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(retryTimer);
      window.clearTimeout(connectTimeout);
      if (probeSocket) {
        try {
          probeSocket.close();
        } catch {
          // Ignore close races while the probe is being discarded.
        }
        if (socketRef.current === probeSocket) {
          socketRef.current = null;
        }
        probeSocket = null;
      }
    };
  }, [player, roomCode, ticket, transportMode]);

  useEffect(() => {
    if (!player || connectionState !== 'connected' || transportMode !== 'socket') return;
    void sendCommand(createMatchCommand('match.sync', player.playerId, {}));
  }, [connectionState, player, sendCommand, transportMode]);

  useEffect(() => {
    if (!state.needsSync || !player || !ticket) return;
    void sendCommand(createMatchCommand('match.sync', player.playerId, {}));
  }, [player, sendCommand, state.needsSync, ticket]);

  return {
    room: state.room,
    match: state.match,
    transportMode,
    connectionState,
    lastErrorCode: state.lastErrorCode,
    needsSync: state.needsSync,
    sendCommand
  };
}
