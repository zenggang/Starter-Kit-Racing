import type express from 'express';
import { getMysqlPool } from '../../db/mysql.js';
import { listRaceRecords } from '../../services/raceRecordService.js';

export function registerRaceRecordRoutes(app: express.Express): void {
  app.get('/api/race-records', async (_req, res) => {
    const records = await listRaceRecords(getMysqlPool()).catch(() => []);
    res.json({ ok: true, records });
  });
}
