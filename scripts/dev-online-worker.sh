#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NEXT_PORT="${NEXT_PORT:-3000}"

echo "Starting Next dev server on http://localhost:${NEXT_PORT}"
echo "Mode: local Next + coordinator configured by .env.local."

cd "$ROOT_DIR"
env \
  -u COORDINATOR_URL \
  -u COORDINATOR_BRIDGE_ENABLED \
  -u COORDINATOR_SHARED_SECRET \
  -u NEXT_PUBLIC_SUPABASE_URL \
  -u NEXT_PUBLIC_SUPABASE_ANON_KEY \
  -u SUPABASE_URL \
  -u SUPABASE_SERVICE_ROLE_KEY \
  npm run dev -- --port "$NEXT_PORT"
