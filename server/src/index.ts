import cors from 'cors';
import express from 'express';
import { createServer } from 'node:http';
import { Server, matchMaker } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { readServerConfig } from './config.js';
import { createMysqlPool, setMysqlPool } from './db/mysql.js';
import { registerHealthRoute } from './http/routes/health.js';
import { registerLeaderboardRoutes } from './http/routes/leaderboard.js';
import { registerRaceRecordRoutes } from './http/routes/raceRecords.js';
import { registerRoomRoutes } from './http/routes/rooms.js';
import { registerTrackRoutes } from './http/routes/tracks.js';
import { RaceRoom } from './rooms/RaceRoom.js';

const config = readServerConfig();
const pool = createMysqlPool(config);
setMysqlPool(pool);

const app = express();
app.use(
  cors({
    /**
     * Browser API calls now hit the ECS HTTPS IP directly from both the custom
     * Vercel domain and the Vercel default deployment domain. Accept either
     * origin while still rejecting unrelated websites.
     */
    origin(origin, callback) {
      if (!origin || config.public.corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error('CORS_ORIGIN_NOT_ALLOWED'));
    },
    credentials: true
  })
);
app.use(express.json({ limit: '1mb' }));

registerHealthRoute(app);
registerRoomRoutes(app);
registerTrackRoutes(app);
registerLeaderboardRoutes(app);
registerRaceRecordRoutes(app);

const httpServer = createServer(app);

const gameServer = new Server({
  transport: new WebSocketTransport({
    server: httpServer,
    pingInterval: 10_000,
    pingMaxRetries: 4,
    maxPayload: 1024 * 1024
  })
});

gameServer.define('race_room', RaceRoom);
matchMaker.controller.exposedMethods = ['joinById', 'reconnect'];

httpServer.listen(config.port, config.host, () => {
  console.log(`race server listening on http://${config.host}:${config.port}`);
});
