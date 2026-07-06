import { config as loadDotenv } from 'dotenv';

loadDotenv();

export interface ServerConfig {
  nodeEnv: string;
  host: string;
  port: number;
  mysql: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
  };
  public: {
    colyseusUrl: string;
    corsOrigins: string[];
  };
}

/**
 * Production traffic can arrive from the fresh WeChat test domain, the previous
 * race2 domain, or the default Vercel project domain. Keeping all three in the
 * default list makes local and ad-hoc deployments tolerant while still requiring
 * unrelated origins to be rejected by the CORS middleware.
 */
const DEFAULT_CORS_ORIGINS = 'https://race3.pigou.top,https://race2.pigou.top,https://race-online2.vercel.app';

export function readServerConfig(env: Record<string, string | undefined> = process.env): ServerConfig {
  const corsOrigins = (env.CORS_ORIGIN ?? DEFAULT_CORS_ORIGINS)
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  return {
    nodeEnv: env.NODE_ENV ?? 'development',
    host: env.HOST ?? '127.0.0.1',
    port: Number(env.PORT ?? '2567'),
    mysql: {
      host: env.MYSQL_HOST ?? '127.0.0.1',
      port: Number(env.MYSQL_PORT ?? '3306'),
      database: env.MYSQL_DATABASE ?? '',
      user: env.MYSQL_USER ?? '',
      password: env.MYSQL_PASSWORD ?? ''
    },
    public: {
      /**
       * The backend no longer treats `game.pigou.top` as the new-chain default.
       * The default public realtime address now points at the ECS WSS IP entry,
       * while concrete deployments can still override it explicitly.
       */
      colyseusUrl: env.COLYSEUS_PUBLIC_URL ?? 'wss://8.148.79.214/colyseus',
      corsOrigins
    }
  };
}
