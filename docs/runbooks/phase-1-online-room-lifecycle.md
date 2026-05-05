# Online Racing Runbook

This runbook tracks the current online racing shell. The file name still says
`phase-1` for compatibility with older links, but the scope now covers the
verified multiplayer flow: socket-first transport, bridge fallback, start
countdown, ghost cars, custom tracks, minimap, result page, and rematch.

## Local Demo Mode

Run without Supabase public env:

```bash
npm run dev
```

Open `/`. The page should show local demo mode and `/race/demo` should mount the default racing runtime.

## Online Mode Env

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
COORDINATOR_URL=
COORDINATOR_SHARED_SECRET=
COORDINATOR_BRIDGE_ENABLED=true
```

Do not expose service role keys or coordinator shared secrets through
`NEXT_PUBLIC_*`.

## Database

```bash
supabase db reset
```

Expected:

- `racing_rooms` exists.
- `racing_room_players` exists.
- `racing_tracks` exists.
- `racing_matches` allows `countdown`, `live`, `finished`, and `aborted` phases.
- `racing_matches.room_code`, `track_id`, and `track_name` exist for durable match summaries.
- Duplicate non-null color in the same room is rejected.
- Anonymous read only returns waiting rooms that are not expired.
- Anonymous clients do not write room, match, result, or track library truth directly.

## Worker

```bash
cd realtime-worker
npm install
npm test
npm run typecheck
```

Expected: create, join, lap target validation, color conflict, ready/start,
countdown promotion, telemetry, finish deadline, result ranking, broadcast, and
timeout tests pass.

## App Verification

```bash
npm run lint
npm run test
npm run build
```

Manual desktop smoke:

1. Open `/hall` in two browser windows.
2. Window A creates a room with the default track.
3. Window B joins by room code.
4. A and B choose different colors.
5. A and B ready.
6. Host starts.
7. Both clients enter `/race/[code]` and see the same 15 second authoritative countdown.
8. Countdown phase keeps race time at zero and locks local input.
9. At `GO!`, both clients can drive and see the other player as a translucent ghost car.
10. HUD shows lap count, race timer, track name, realtime leaderboard, and minimap.
11. The first finisher loses control and stays on the race page until the match finishes.
12. Result page shows final ranking and host rematch returns players to the room.

Manual custom-track smoke:

1. Open `/track-editor`.
2. Draw a legal closed loop with one finish tile.
3. Save it with a name and verify it appears in the saved track list.
4. Return to `/hall`, select that track, and create a room.
5. Join with a second browser and verify room/race/result surfaces show the selected track name.
6. Start and finish the match, verifying both clients load the same `match.trackMap`.
7. Edit or delete the original saved track after room creation; the already created room should keep its track snapshot.

Transport smoke:

1. With a valid `COORDINATOR_URL`, ticket selection should prefer `socket`.
2. During socket mode, high-frequency `match.progress` should travel over WebSocket.
3. If the socket cannot open, the client falls back to same-origin bridge and keeps a 5 second snapshot sync loop.
4. Bridge mode must not increase telemetry to a high-frequency HTTP tick.

Manual mobile smoke:

1. Use a 390x844 viewport or a real mobile browser.
2. Open `/hall`; verify no horizontal overflow.
3. Create or join a room; verify color swatches and ready/start buttons are finger-sized.
4. Enter `/race/[code]`; verify the canvas fills the visible viewport.
5. Verify countdown, HUD, minimap, leaderboard, and touch controls stay inside safe-area bounds.
6. Drive with touch controls; verify page scrolling does not steal steering input.
7. Rotate or collapse browser chrome; verify controls remain usable.

## Current Limits

- Racing physics remain browser-local. The coordinator is authoritative for room state, match phase, telemetry ordering, rank, finish, and result shape, not for 60Hz vehicle simulation.
- Ghost cars are visual only and do not participate in crashcat collisions.
- Custom tracks are player-owned by local `playerId`; this is a lightweight identity boundary, not a full account/auth model.
- Result rows are written by trusted server/worker paths and are not publicly queryable through anon RLS yet.
- `bridge` is a recovery/fallback path. Socket mode is the expected live racing transport.
