import { monitorEventLoopDelay } from 'node:perf_hooks';
import type { Pool } from 'mysql2/promise';
import { getMysqlPool } from '../db/mysql.js';
import { listActiveRoomIds } from './inMemoryRoomIndex.js';

const BYTES_PER_MEBIBYTE = 1024 * 1024;
const NANOSECONDS_PER_MILLISECOND = 1_000_000;
const DEFAULT_REPORT_INTERVAL_MS = 60_000;
const MIN_REPORT_INTERVAL_MS = 1_000;

interface MysqlPoolInternals {
  config?: {
    connectionLimit?: number;
  };
  _allConnections?: unknown[];
  _freeConnections?: unknown[];
  _connectionQueue?: unknown[];
}

interface MysqlPoolCarrier {
  pool?: MysqlPoolInternals;
}

export interface MysqlPoolRuntimeState {
  connectionLimit: number | null;
  allConnections: number;
  freeConnections: number;
  queuedRequests: number;
}

export interface RuntimeDiagnosticsSnapshot {
  timestamp: string;
  rooms: {
    active: number;
    ids: string[];
  };
  connections: {
    active: number;
  };
  messages: {
    total: number;
    perSecond: number;
    byType: Record<string, number>;
  };
  memory: {
    rssMb: number;
    heapTotalMb: number;
    heapUsedMb: number;
    externalMb: number;
    arrayBuffersMb: number;
  };
  eventLoop: {
    meanMs: number;
    maxMs: number;
    p95Ms: number;
  };
  mysqlPool: MysqlPoolRuntimeState;
}

interface RuntimeSnapshotInput {
  timestamp: string;
  roomIds: string[];
  activeConnections: number;
  messageCount: number;
  messageTypeCounts: Record<string, number>;
  windowMs: number;
  memoryUsage: NodeJS.MemoryUsage;
  eventLoopDelayNs: {
    mean: number;
    max: number;
    p95: number;
  };
  mysqlPool: MysqlPoolRuntimeState;
}

const counters = {
  activeConnections: 0,
  messageCount: 0,
  messageTypeCounts: new Map<string, number>()
};

const eventLoopDelayHistogram = monitorEventLoopDelay({ resolution: 20 });
let reportTimer: NodeJS.Timeout | null = null;
let previousReportAt = Date.now();

function toRoundedMegabytes(bytes: number): number {
  return Math.round((bytes / BYTES_PER_MEBIBYTE) * 100) / 100;
}

function toRoundedMilliseconds(nanoseconds: number): number {
  if (!Number.isFinite(nanoseconds)) {
    return 0;
  }

  return Math.round((nanoseconds / NANOSECONDS_PER_MILLISECOND) * 100) / 100;
}

/**
 * mysql2/promise does not expose pool occupancy in its public API. The
 * underlying callback-style pool still keeps connection counters that are
 * stable enough for operational diagnostics, so we read them defensively and
 * fall back to zero/unknown when mysql2 changes its internals.
 */
export function readMysqlPoolRuntimeState(poolLike: unknown): MysqlPoolRuntimeState {
  const carrier = (poolLike ?? {}) as MysqlPoolCarrier;
  const internalPool = carrier.pool;

  return {
    connectionLimit: internalPool?.config?.connectionLimit ?? null,
    allConnections: internalPool?._allConnections?.length ?? 0,
    freeConnections: internalPool?._freeConnections?.length ?? 0,
    queuedRequests: internalPool?._connectionQueue?.length ?? 0
  };
}

/**
 * The periodic reporter emits a compact JSON document so a future “machine
 * looked alive but the game timed out” incident can be classified from logs
 * without reconstructing live counters by hand after the fact.
 */
export function buildRuntimeDiagnosticsSnapshot(input: RuntimeSnapshotInput): RuntimeDiagnosticsSnapshot {
  return {
    timestamp: input.timestamp,
    rooms: {
      active: input.roomIds.length,
      ids: input.roomIds
    },
    connections: {
      active: input.activeConnections
    },
    messages: {
      total: input.messageCount,
      perSecond: Math.round((input.messageCount / Math.max(input.windowMs / 1000, 1)) * 100) / 100,
      byType: input.messageTypeCounts
    },
    memory: {
      rssMb: toRoundedMegabytes(input.memoryUsage.rss),
      heapTotalMb: toRoundedMegabytes(input.memoryUsage.heapTotal),
      heapUsedMb: toRoundedMegabytes(input.memoryUsage.heapUsed),
      externalMb: toRoundedMegabytes(input.memoryUsage.external),
      arrayBuffersMb: toRoundedMegabytes(input.memoryUsage.arrayBuffers)
    },
    eventLoop: {
      meanMs: toRoundedMilliseconds(input.eventLoopDelayNs.mean),
      maxMs: toRoundedMilliseconds(input.eventLoopDelayNs.max),
      p95Ms: toRoundedMilliseconds(input.eventLoopDelayNs.p95)
    },
    mysqlPool: input.mysqlPool
  };
}

/**
 * Shorter intervals are useful for live incident reproduction, but a sub-second
 * reporter would become its own source of noise. Clamp the interval so
 * diagnostics stay readable and safe even if an operator passes a bad value.
 */
export function normalizeDiagnosticsIntervalMs(rawValue: string | undefined): number {
  if (!rawValue) {
    return DEFAULT_REPORT_INTERVAL_MS;
  }

  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_REPORT_INTERVAL_MS;
  }

  return Math.max(MIN_REPORT_INTERVAL_MS, Math.round(parsed));
}

export function recordRealtimeMessage(type: string): void {
  counters.messageCount += 1;
  counters.messageTypeCounts.set(type, (counters.messageTypeCounts.get(type) ?? 0) + 1);
}

export function recordClientJoined(): void {
  counters.activeConnections += 1;
}

export function recordClientLeft(): void {
  counters.activeConnections = Math.max(0, counters.activeConnections - 1);
}

function flushRuntimeSnapshot(pool: Pool): RuntimeDiagnosticsSnapshot {
  const now = Date.now();
  const snapshot = buildRuntimeDiagnosticsSnapshot({
    timestamp: new Date(now).toISOString(),
    roomIds: listActiveRoomIds(),
    activeConnections: counters.activeConnections,
    messageCount: counters.messageCount,
    messageTypeCounts: Object.fromEntries(counters.messageTypeCounts),
    windowMs: now - previousReportAt,
    memoryUsage: process.memoryUsage(),
    eventLoopDelayNs: {
      mean: eventLoopDelayHistogram.mean,
      max: eventLoopDelayHistogram.max,
      p95: eventLoopDelayHistogram.percentile(95)
    },
    mysqlPool: readMysqlPoolRuntimeState(pool)
  });

  counters.messageCount = 0;
  counters.messageTypeCounts.clear();
  previousReportAt = now;
  eventLoopDelayHistogram.reset();
  return snapshot;
}

export function startRuntimeDiagnosticsReporter(
  pool: Pool = getMysqlPool(),
  logger: (message: string) => void = console.log,
  intervalMs: number = DEFAULT_REPORT_INTERVAL_MS
): void {
  if (reportTimer) {
    return;
  }

  previousReportAt = Date.now();
  eventLoopDelayHistogram.enable();

  reportTimer = setInterval(() => {
    const snapshot = flushRuntimeSnapshot(pool);
    logger(`[runtime-diagnostics] ${JSON.stringify(snapshot)}`);
  }, intervalMs);
  reportTimer.unref();
}
