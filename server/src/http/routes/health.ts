import type express from 'express';
import { pingMysql } from '../../db/mysql.js';

export function registerHealthRoute(app: express.Express): void {
  /**
   * Expose the same health payload on both `/health` and `/api/health`.
   *
   * `/health` keeps backward compatibility with direct backend probes and the
   * old ECS checks, while `/api/health` matches the public API namespace used
   * by Vercel and the new IP-based Nginx reverse proxy.
   */
  const handleHealthRequest: express.RequestHandler = async (_req, res) => {
    const mysql = await pingMysql().catch(() => false);
    res.json({ ok: true, mysql });
  };

  app.get('/health', handleHealthRequest);
  app.get('/api/health', handleHealthRequest);
}
