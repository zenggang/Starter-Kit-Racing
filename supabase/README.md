# Supabase schema

Supabase is the durable read-model layer for the online shell. It is intentionally not the live race authority.

## Responsibility boundary

- `coordinator` owns room lifecycle truth, match lifecycle truth, ordering, winner selection, and timeout transitions.
- `bridge` or server routes should persist only coordinator-approved snapshots by using server-only Supabase credentials.
- `Supabase` keeps read models that must survive refreshes, reconnects, rematches, or result-page reloads.

The important constraint is that high-frequency race telemetry does not belong in Postgres. `match.progress` may be emitted often, but only durable room state and final result/progress snapshots should be written here.

## Local migration

```bash
supabase db reset
```

Use `NEXT_PUBLIC_SUPABASE_URL` plus `NEXT_PUBLIC_SUPABASE_ANON_KEY` for browser-safe reads, and `SUPABASE_URL` plus `SUPABASE_SERVICE_ROLE_KEY` for coordinator/bridge persistence jobs. If the Cloudflare worker becomes the direct writer, mirror the same server-only values into worker secrets instead of `NEXT_PUBLIC_*`.

## Tables

- `racing_rooms`: public hall read model for waiting-room metadata such as room code, host, status, lap target, track selection, and lifecycle timestamps.
- `racing_room_players`: public hall roster projection for room members, selected color, ready state, host flag, and last-seen time.
- `racing_matches`: private durable match header rows. One row per race start, carrying phase, lap target, track map, start/finish timestamps, and winner player id.
- `racing_match_results`: private durable per-player result rows. Stores final rank, presence, completed laps, final lap progress, total progress, and finish/report timestamps.

## Read and write expectations

- Anonymous browser clients may only read waiting rooms that are still in `waiting` status and not expired.
- Result rows are intentionally not exposed through anon policies yet. Read or write them through trusted server/worker code until a public result query contract is explicitly designed.
- Rematches should create a new `racing_matches` row and a fresh set of `racing_match_results` rows instead of mutating prior historical results.
