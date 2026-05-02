# Starter Kit Racing

A JavaScript/Three.js port of [Kenney's Starter Kit Racing](https://github.com/KenneyNL/Starter-Kit-Racing).

[Live demo](https://mrdoob.github.io/Starter-Kit-Racing/)

## Online shell

Phase 1 adds a mobile-first Next.js shell for online room lifecycle work:

- `/` selects local demo mode when Supabase public env is missing.
- `/hall` creates and joins coordinator-backed rooms.
- `/room/[code]` handles color, ready and host start.
- `/race/[code]` mounts the existing Three.js racing runtime into the app shell.

The original static `index.html` and `editor.html` remain as compatibility entry points while the online shell is migrated.

## Realtime boundary

The current online stack deliberately splits authority instead of treating Supabase as a live race bus:

- `coordinator` owns room truth, match truth, command ordering, timeout transitions, rank calculation, and finish/winner decisions.
- `bridge` and server routes sign tickets, proxy authenticated commands, and are the right place to persist coordinator-approved room or result snapshots with server-only credentials.
- `Supabase` is the durable read-model layer. It restores waiting rooms for `/hall` and stores historical match/results snapshots that must survive refreshes or rematches.

High-frequency `match.progress` telemetry should stay in coordinator memory or transport messages. Do not write every frame into Postgres.

## Supabase durable models

The repository currently uses two different durability shapes:

- `racing_rooms` and `racing_room_players` are the public waiting-room read model consumed by the hall list.
- `racing_matches` and `racing_match_results` are the durable result model for one race start plus each player's final ordering/progress snapshot.

At the moment, the hall list already reads `racing_rooms`, while result persistence is schema/documentation groundwork for the next coordinator or bridge write path. See `supabase/README.md` for table responsibilities and RLS expectations.

## Environment

Copy `.env.example` and keep the split explicit:

- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are browser-safe and only power public hall reads plus online-mode detection.
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are server/worker-only and should be used when persisting room lifecycle or match result rows.
- `COORDINATOR_SHARED_SECRET` stays server-only for ticket signing and bridge forwarding.

If the Cloudflare worker later writes durable result rows directly, mirror the same server-only Supabase writer variables into the worker secret store rather than exposing them to the browser bundle.

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

See `docs/runbooks/phase-1-online-room-lifecycle.md` for Supabase, coordinator and mobile smoke verification.

## Credits

- Game assets by [Kenney](https://kenney.nl/) (CC0)
- Physics engine: [crashcat](https://github.com/isaac-mason/crashcat)
- Ported to JavaScript with [Claude](https://claude.ai/)
