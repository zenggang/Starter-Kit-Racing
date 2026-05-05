# Supabase schema

Supabase is the durable read-model layer for the online shell. It is intentionally not the live race authority.

## Responsibility boundary

- `coordinator` owns room lifecycle truth, match lifecycle truth, ordering, winner selection, and timeout transitions.
- `bridge`, server routes, or the worker should persist only coordinator-approved snapshots by using server-only Supabase credentials.
- `Supabase` keeps read models that must survive refreshes, reconnects, rematches, or result-page reloads.

The important constraint is that high-frequency race telemetry does not belong in Postgres. `match.progress` may be emitted often, but only durable room state and final result/progress snapshots should be written here.

## Local migration

```bash
supabase db reset
```

Use `NEXT_PUBLIC_SUPABASE_URL` plus `NEXT_PUBLIC_SUPABASE_ANON_KEY` for
browser-safe reads, and `SUPABASE_URL` plus `SUPABASE_SERVICE_ROLE_KEY` for
server or worker persistence jobs. If the Cloudflare worker writes directly,
mirror the same server-only values into worker secrets instead of
`NEXT_PUBLIC_*`.

## Tables

- `racing_rooms`: public hall read model for waiting-room metadata such as room code, host, status, lap target, track selection, and lifecycle timestamps.
- `racing_room_players`: public hall roster projection for room members, selected color, ready state, host flag, and last-seen time.
- `racing_tracks`: private player-owned custom track library used by `/track-editor` and room creation. Rooms and matches keep their own `track_map` snapshots, so later edits or deletes do not affect existing rooms or historical results.
- `racing_matches`: private durable match header rows. One row per race start, carrying room code, phase, lap target, track snapshot, official start/finish timestamps, and winner player id.
- `racing_match_results`: private durable per-player result rows. Stores final rank, presence, completed laps, final lap progress, total progress, and finish/report timestamps.

## Match phase semantics

- `racing_rooms.started_at` is the moment the host successfully starts the room and the countdown begins.
- `racing_matches.phase = 'countdown'` is the authoritative pre-start state.
- `racing_matches.started_at` is the official race start time after the 15 second countdown.
- `racing_matches.phase = 'live'` means telemetry can affect rank and finish state.
- `racing_matches.phase = 'finished'` or `aborted` is the durable terminal state used for final result writes.

## Read and write expectations

- Anonymous browser clients may only read waiting rooms that are still in `waiting` status and not expired.
- Track library, match, and result writes go through trusted server or worker code using service-role credentials. Browser clients never write durable room or match truth directly.
- Result rows are intentionally not exposed through anon policies yet. Read or write them through trusted server/worker code until a public result query contract is explicitly designed.
- Rematches should create a new `racing_matches` row and a fresh set of `racing_match_results` rows instead of mutating prior historical results.
