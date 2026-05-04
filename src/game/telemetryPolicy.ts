import type { TransportMode } from '@/realtime/protocol';

const SOCKET_RACE_TELEMETRY_INTERVAL_MS = 100;
const BRIDGE_RACE_TELEMETRY_INTERVAL_MS = 300;

/**
 * Race telemetry only powers coordinator ranking and finish detection today, so
 * it can use a slower cadence than the local render loop. Bridge fallback gets
 * the slowest cadence because each sample becomes an HTTP request, while socket
 * mode can stay slightly tighter without reopening the DO request floodgate.
 */
export function getRaceTelemetryIntervalMs(transportMode: TransportMode | null): number {
  return transportMode === 'bridge' ? BRIDGE_RACE_TELEMETRY_INTERVAL_MS : SOCKET_RACE_TELEMETRY_INTERVAL_MS;
}
