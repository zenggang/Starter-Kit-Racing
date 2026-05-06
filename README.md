# Starter Kit Racing

A JavaScript/Three.js port of [Kenney's Starter Kit Racing](https://github.com/KenneyNL/Starter-Kit-Racing).

[Live demo](https://mrdoob.github.io/Starter-Kit-Racing/)

## Online shell

The current app is a mobile-first online racing shell around the original
Three.js runtime:

- `/` is the fixed public game entry for embedded browsers such as WeChat. It
  keeps the browser URL stable while hall, room, race, result, and track editor
  screens move through internal game state.
- `/hall` creates and joins coordinator-backed rooms, including default or saved custom track selection.
- `/room/[code]` handles color, ready, lap target, host start, and current track display.
- `/race/[code]` mounts the Three.js runtime, shows the authoritative start countdown, reports race telemetry, renders ghost cars, and drives the HUD/minimap.
- `/result/[code]` shows coordinator-approved race results and supports host rematch.
- `/track-editor` creates, validates, saves, edits, and deletes player-owned custom tracks.

The route-specific pages remain available as compatibility and debugging
entries, but the shareable mobile game link should use the bare domain root.

The original static `index.html` and `editor.html` remain as compatibility entry
points for local runtime/editor access.

## Realtime boundary

The current online stack deliberately splits authority instead of treating Supabase as a live race bus:

- `coordinator` owns room truth, match truth, command ordering, timeout transitions, rank calculation, and finish/winner decisions.
- WebSocket is the primary live transport. The same-origin `bridge` remains the fallback for command forwarding and snapshot recovery.
- Server routes sign tickets, proxy authenticated bridge commands, resolve custom track ownership, and persist coordinator-approved room or match snapshots with server-only credentials.
- `Supabase` is the durable read-model layer. It restores waiting rooms for `/hall` and stores historical match/results snapshots that must survive refreshes or rematches.

High-frequency `match.progress` telemetry should stay in coordinator memory or transport messages. Do not write every frame into Postgres.

## Supabase durable models

The repository currently uses three durability shapes:

- `racing_rooms` and `racing_room_players` are the public waiting-room read model consumed by the hall list.
- `racing_tracks` is the player-owned custom track library used by the editor and room creation flow.
- `racing_matches` and `racing_match_results` are the durable match/result model for one race start plus each player's final ordering/progress snapshot.

Server and worker writers persist coordinator-approved room lifecycle snapshots,
match headers, and final match results. See `supabase/README.md` for table
responsibilities, phase semantics, and RLS expectations.

## Environment

Copy `.env.example` and keep the split explicit:

- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are browser-safe and only power public hall reads plus online-mode detection.
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are server/worker-only and are used for room lifecycle, custom track library, match header, and final result writes.
- `COORDINATOR_URL` selects the Cloudflare coordinator endpoint. Valid coordinator URLs are offered to the browser as socket-first transport.
- `COORDINATOR_SHARED_SECRET` stays server-only for ticket signing and bridge forwarding.

If the Cloudflare worker writes durable rows directly, mirror the same server-only
Supabase writer variables into the worker secret store rather than exposing them
to the browser bundle.

## Development

```bash
npm install
npm run dev
```

Run checks:

```bash
npm run lint
npm run test
npm run build
```

See `docs/runbooks/phase-1-online-room-lifecycle.md` for Supabase, coordinator,
desktop/mobile, default-track, custom-track, countdown, ghost-car, result, and
rematch smoke verification.

## Credits

- Game assets by [Kenney](https://kenney.nl/) (CC0)
- Physics engine: [crashcat](https://github.com/isaac-mason/crashcat)
- Ported to JavaScript with [Claude](https://claude.ai/)
