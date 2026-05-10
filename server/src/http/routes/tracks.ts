import type express from 'express';
import { getMysqlPool } from '../../db/mysql.js';
import { getTrack, listTracks, softDeleteTrack, upsertTrack } from '../../services/trackService.js';

export function registerTrackRoutes(app: express.Express): void {
  app.get('/api/tracks', async (req, res) => {
    const playerId = String(req.query.playerId ?? '').trim();
    if (!playerId) {
      res.status(400).json({ ok: false, errorCode: 'AUTH_TICKET_INVALID' });
      return;
    }

    const tracks = await listTracks(getMysqlPool(), playerId).catch(() => []);
    res.json({ ok: true, tracks });
  });

  app.post('/api/tracks', async (req, res) => {
    const playerId = String(req.body?.playerId ?? '').trim();
    const name = String(req.body?.name ?? '');
    const trackMap = String(req.body?.trackMap ?? '');

    if (!playerId || !trackMap) {
      res.status(400).json({ ok: false, errorCode: 'TRACK_MAP_INVALID' });
      return;
    }

    try {
      const track = await upsertTrack(getMysqlPool(), playerId, name, trackMap);
      res.json({ ok: true, track });
    } catch (error) {
      res.status(400).json({ ok: false, errorCode: error instanceof Error ? error.message : 'TRACK_MAP_INVALID' });
    }
  });

  app.get('/api/tracks/:id', async (req, res) => {
    const playerId = String(req.query.playerId ?? '').trim();
    const trackId = String(req.params.id ?? '').trim();

    if (!playerId || !trackId) {
      res.status(400).json({ ok: false, errorCode: 'AUTH_TICKET_INVALID' });
      return;
    }

    const track = await getTrack(getMysqlPool(), playerId, trackId);
    if (!track) {
      res.status(404).json({ ok: false, errorCode: 'TRACK_NOT_FOUND' });
      return;
    }

    res.json({ ok: true, track });
  });

  app.patch('/api/tracks/:id', async (req, res) => {
    const playerId = String(req.body?.playerId ?? '').trim();
    const name = String(req.body?.name ?? '');
    const trackMap = String(req.body?.trackMap ?? '');
    const trackId = String(req.params.id ?? '').trim();

    if (!playerId || !trackMap || !trackId) {
      res.status(400).json({ ok: false, errorCode: 'TRACK_MAP_INVALID' });
      return;
    }

    try {
      const track = await upsertTrack(getMysqlPool(), playerId, name, trackMap, trackId);
      res.json({ ok: true, track });
    } catch (error) {
      res.status(400).json({ ok: false, errorCode: error instanceof Error ? error.message : 'TRACK_MAP_INVALID' });
    }
  });

  app.delete('/api/tracks/:id', async (req, res) => {
    const playerId = String(req.query.playerId ?? '').trim();
    const trackId = String(req.params.id ?? '').trim();

    if (!playerId || !trackId) {
      res.status(400).json({ ok: false, errorCode: 'AUTH_TICKET_INVALID' });
      return;
    }

    const deleted = await softDeleteTrack(getMysqlPool(), playerId, trackId);
    if (!deleted) {
      res.status(404).json({ ok: false, errorCode: 'TRACK_NOT_FOUND' });
      return;
    }

    res.json({ ok: true });
  });
}
