import { describe, expect, it } from 'vitest';
import { buildRuntimeDiagnosticsSnapshot, readMysqlPoolRuntimeState } from './runtimeDiagnostics.js';

describe('runtime diagnostics', () => {
  it('extracts mysql pool internals for runtime logging', () => {
    const snapshot = readMysqlPoolRuntimeState({
      pool: {
        config: {
          connectionLimit: 10
        },
        _allConnections: [{}, {}, {}],
        _freeConnections: [{}],
        _connectionQueue: [{}, {}]
      }
    });

    expect(snapshot).toEqual({
      connectionLimit: 10,
      allConnections: 3,
      freeConnections: 1,
      queuedRequests: 2
    });
  });

  it('builds a minute-level snapshot with memory, room, connection, message and event-loop metrics', () => {
    const snapshot = buildRuntimeDiagnosticsSnapshot({
      timestamp: '2026-05-10T08:00:00.000Z',
      roomIds: ['3009', '4758'],
      activeConnections: 3,
      messageCount: 120,
      messageTypeCounts: {
        'sync.request': 100,
        'room.join': 20
      },
      windowMs: 60_000,
      memoryUsage: {
        rss: 200 * 1024 * 1024,
        heapTotal: 80 * 1024 * 1024,
        heapUsed: 40 * 1024 * 1024,
        external: 8 * 1024 * 1024,
        arrayBuffers: 2 * 1024 * 1024
      },
      eventLoopDelayNs: {
        mean: 2_500_000,
        max: 15_000_000,
        p95: 8_000_000
      },
      mysqlPool: {
        connectionLimit: 10,
        allConnections: 4,
        freeConnections: 2,
        queuedRequests: 1
      }
    });

    expect(snapshot).toEqual({
      timestamp: '2026-05-10T08:00:00.000Z',
      rooms: {
        active: 2,
        ids: ['3009', '4758']
      },
      connections: {
        active: 3
      },
      messages: {
        total: 120,
        perSecond: 2,
        byType: {
          'sync.request': 100,
          'room.join': 20
        }
      },
      memory: {
        rssMb: 200,
        heapTotalMb: 80,
        heapUsedMb: 40,
        externalMb: 8,
        arrayBuffersMb: 2
      },
      eventLoop: {
        meanMs: 2.5,
        maxMs: 15,
        p95Ms: 8
      },
      mysqlPool: {
        connectionLimit: 10,
        allConnections: 4,
        freeConnections: 2,
        queuedRequests: 1
      }
    });
  });
});
