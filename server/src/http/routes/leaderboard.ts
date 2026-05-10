import type express from 'express';
import { getMysqlPool } from '../../db/mysql.js';
import { listLeaderboard } from '../../services/leaderboardService.js';

export function registerLeaderboardRoutes(app: express.Express): void {
  app.get('/api/leaderboard', async (_req, res) => {
    const leaderboard = await listLeaderboard(getMysqlPool()).catch(() => []);
    res.json({ ok: true, leaderboard });
  });
}
