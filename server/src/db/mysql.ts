import { createPool, type Pool, type PoolOptions, type RowDataPacket } from 'mysql2/promise';
import type { ServerConfig } from '../config.js';

let pool: Pool | null = null;

export function createMysqlPool(config: ServerConfig): Pool {
  const options: PoolOptions = {
    host: config.mysql.host,
    port: config.mysql.port,
    database: config.mysql.database,
    user: config.mysql.user,
    password: config.mysql.password,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: 'utf8mb4'
  };

  return createPool(options);
}

export function setMysqlPool(nextPool: Pool): void {
  pool = nextPool;
}

export function getMysqlPool(): Pool {
  if (!pool) {
    throw new Error('MYSQL_POOL_NOT_INITIALIZED');
  }

  return pool;
}

export async function pingMysql(nextPool: Pool = getMysqlPool()): Promise<boolean> {
  const [rows] = await nextPool.query<RowDataPacket[]>('select 1 as ok');
  return rows[0]?.ok === 1;
}
