import type express from 'express';
import { matchMaker } from '@colyseus/core';
import type { RowDataPacket } from 'mysql2/promise';
import { getMysqlPool } from '../../db/mysql.js';
import type { TrackSummary } from '../../services/trackService.js';

interface RoomListRow extends RowDataPacket {
  code: string;
  lap_target: number;
  track_name: string | null;
  expires_at: string;
  player_count: number;
}

export function registerRoomRoutes(app: express.Express): void {
  app.get('/api/rooms', async (_req, res) => {
    const [rows] = await getMysqlPool()
      .query<RoomListRow[]>(
        `
          select
            r.code,
            r.lap_target,
            r.track_name,
            date_format(r.expires_at, '%Y-%m-%dT%H:%i:%sZ') as expires_at,
            count(rp.player_id) as player_count
          from racing_rooms r
          left join racing_room_players rp on rp.room_id = r.id
          where r.status = 'waiting' and r.expires_at > utc_timestamp()
          group by r.id, r.code, r.lap_target, r.track_name, r.expires_at
          order by r.created_at desc
          limit 20
        `
      )
      .catch(() => [[] as RoomListRow[]]);

    const rooms = rows.map((room) => ({
      code: room.code,
      lapTarget: room.lap_target,
      trackName: room.track_name,
      playerCount: Number(room.player_count ?? 0),
      expiresAt: room.expires_at
    }));

    res.json({ ok: true, rooms });
  });

  app.post('/api/rooms', async (req, res) => {
    const action = String(req.body?.action ?? '').trim();
    const playerId = String(req.body?.playerId ?? '').trim();
    const nickname = String(req.body?.nickname ?? '').trim();
    const startedAt = Date.now();

    if (!playerId || !nickname) {
      res.status(400).json({ ok: false, errorCode: 'AUTH_TICKET_INVALID' });
      return;
    }

    try {
      if (action === 'create') {
        const selectedTrack = normalizeSelectedTrack(req.body?.track);
        const reservation = await matchMaker.create('race_room', {
          playerId,
          nickname,
          roomCode: req.body?.roomCode,
          trackId: selectedTrack?.id ?? null,
          trackName: selectedTrack?.name ?? null,
          trackMap: selectedTrack?.trackMap ?? null
        });

        res.json({
          ok: true,
          roomCode: reservation.room.roomId,
          reservation: serializeSeatReservation(reservation)
        });
        return;
      }

      if (action === 'join') {
        const roomCode = String(req.body?.roomCode ?? '').trim().toUpperCase();
        if (!roomCode) {
          res.status(400).json({ ok: false, errorCode: 'ROOM_NOT_FOUND' });
          return;
        }

        const reservation = await matchMaker.joinById(roomCode, {
          playerId,
          nickname
        });

        res.json({
          ok: true,
          roomCode,
          reservation: serializeSeatReservation(reservation)
        });
        return;
      }

      res.status(400).json({ ok: false, errorCode: 'ROOM_NOT_FOUND' });
    } catch (error) {
      res.status(404).json({
        ok: false,
        errorCode: error instanceof Error && /room/i.test(error.message) ? 'ROOM_NOT_FOUND' : 'COORDINATOR_NOT_READY'
      });
    }
  });
}

/**
 * MatchMaker 的 reservation 对象在 Node 侧带有额外运行时属性。HTTP 层只返回
 * 浏览器 `consumeSeatReservation()` 真正需要的字段，避免回包阶段被隐藏属性或
 * 非可序列化成员拖住。
 */
interface SerializableSeatReservation {
  room: {
    name: string;
    roomId: string;
    clients: number;
    maxClients: number;
    metadata?: unknown;
    processId?: string;
    publicAddress?: string;
  };
  sessionId: string;
  reconnectionToken?: string;
  devMode?: boolean;
  protocol?: string;
}

function serializeSeatReservation(reservation: {
  room: {
    name: string;
    roomId: string;
    clients: number;
    maxClients: number;
    metadata?: unknown;
    processId?: string;
    publicAddress?: string;
  };
  sessionId: string;
  reconnectionToken?: string;
  devMode?: boolean;
  protocol?: string;
}): SerializableSeatReservation {
  return {
    room: {
      name: reservation.room.name,
      roomId: reservation.room.roomId,
      clients: reservation.room.clients,
      maxClients: reservation.room.maxClients,
      metadata: reservation.room.metadata,
      processId: reservation.room.processId,
      publicAddress: reservation.room.publicAddress
    },
    sessionId: reservation.sessionId,
    reconnectionToken: reservation.reconnectionToken,
    devMode: reservation.devMode,
    protocol: reservation.protocol
  };
}

function normalizeSelectedTrack(track: unknown): Pick<TrackSummary, 'id' | 'name' | 'trackMap'> | null {
  if (!track || typeof track !== 'object') return null;

  const candidate = track as Partial<TrackSummary>;
  if (!candidate.trackMap || !candidate.name) {
    return null;
  }

  return {
    id: candidate.id ?? '',
    name: candidate.name,
    trackMap: candidate.trackMap
  };
}
