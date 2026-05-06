#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NEXT_PORT="${NEXT_PORT:-3000}"
WORKER_PORT="${WORKER_PORT:-8787}"

read_env_value() {
  node --input-type=module - "$ROOT_DIR/.env.local" "$1" <<'NODE'
import { readFileSync } from 'node:fs';

const [file, key] = process.argv.slice(2);
let text = '';

try {
  text = readFileSync(file, 'utf8');
} catch {
  process.exit(0);
}

const line = text.split(/\r?\n/u).find((entry) => entry.trim().startsWith(`${key}=`));
if (!line) process.exit(0);

let value = line.slice(line.indexOf('=') + 1).trim();
if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
  value = value.slice(1, -1);
}

process.stdout.write(value);
NODE
}

COORDINATOR_SECRET="${COORDINATOR_SHARED_SECRET:-$(read_env_value COORDINATOR_SHARED_SECRET)}"

if [[ -z "$COORDINATOR_SECRET" ]]; then
  echo "Missing COORDINATOR_SHARED_SECRET. Put it in .env.local or export it before running this script." >&2
  exit 1
fi

if [[ ! -x "$ROOT_DIR/realtime-worker/node_modules/.bin/wrangler" ]]; then
  echo "Missing realtime-worker/node_modules/.bin/wrangler. Run npm install in realtime-worker first." >&2
  exit 1
fi

WORKER_PID=""
NEXT_PID=""

cleanup() {
  if [[ -n "$NEXT_PID" ]] && kill -0 "$NEXT_PID" 2>/dev/null; then
    kill "$NEXT_PID" 2>/dev/null || true
  fi

  if [[ -n "$WORKER_PID" ]] && kill -0 "$WORKER_PID" 2>/dev/null; then
    kill "$WORKER_PID" 2>/dev/null || true
  fi
}

trap cleanup EXIT INT TERM

echo "Starting local coordinator worker on http://localhost:${WORKER_PORT}"
(
  cd "$ROOT_DIR/realtime-worker"
  ./node_modules/.bin/wrangler dev --local --port "$WORKER_PORT" --var "COORDINATOR_SHARED_SECRET:${COORDINATOR_SECRET}"
) &
WORKER_PID="$!"

WORKER_READY=0
for _ in {1..60}; do
  if curl -fsS "http://localhost:${WORKER_PORT}/health" >/dev/null 2>&1; then
    WORKER_READY=1
    break
  fi

  if ! kill -0 "$WORKER_PID" 2>/dev/null; then
    echo "Local coordinator worker exited before becoming ready." >&2
    exit 1
  fi

  sleep 1
done

if [[ "$WORKER_READY" != "1" ]]; then
  echo "Local coordinator worker did not become ready on port ${WORKER_PORT}." >&2
  exit 1
fi

echo "Starting Next dev server on http://localhost:${NEXT_PORT}"
echo "Mode: local Next + local coordinator worker. Supabase server writes are disabled for this process."
(
  cd "$ROOT_DIR"
  NEXT_PUBLIC_SUPABASE_URL="" \
    NEXT_PUBLIC_SUPABASE_ANON_KEY="" \
    SUPABASE_URL="" \
    SUPABASE_SERVICE_ROLE_KEY="" \
    COORDINATOR_URL="http://localhost:${WORKER_PORT}" \
    COORDINATOR_BRIDGE_ENABLED="true" \
    COORDINATOR_SHARED_SECRET="$COORDINATOR_SECRET" \
    npm run dev -- --port "$NEXT_PORT"
) &
NEXT_PID="$!"

wait "$NEXT_PID"
