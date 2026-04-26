# Phase 1 Online Room Lifecycle Runbook

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
COORDINATOR_URL=
COORDINATOR_SHARED_SECRET=
COORDINATOR_BRIDGE_ENABLED=true
```

Do not expose service role keys or coordinator shared secrets through `NEXT_PUBLIC_*`.

## Database

```bash
supabase db reset
```

Expected:

- `racing_rooms` exists.
- `racing_room_players` exists.
- Duplicate non-null color in the same room is rejected.
- Anonymous read only returns waiting rooms that are not expired.

## Worker

```bash
cd realtime-worker
npm install
npm test
```

Expected: create, join, lap target validation, color conflict, ready/start and timeout tests pass.

## App Verification

```bash
npm run lint
npm run test
npm run build
```

Manual desktop smoke:

1. Open `/hall` in two browser windows.
2. Window A creates a room.
3. Window B joins by room code.
4. A and B choose different colors.
5. A and B ready.
6. Host starts.
7. Both clients enter `/race/[code]`.

Manual mobile smoke:

1. Use a 390x844 viewport or a real mobile browser.
2. Open `/hall`; verify no horizontal overflow.
3. Create or join a room; verify color swatches and ready/start buttons are finger-sized.
4. Enter `/race/[code]`; verify the canvas fills the visible viewport.
5. Drive with touch controls; verify page scrolling does not steal steering input.
6. Rotate or collapse browser chrome; verify controls remain inside safe-area bounds.

## Phase 1 Limits

- Default track only.
- No custom map room flow.
- No minimap.
- No realtime leaderboard.
- No authoritative 60Hz racing physics in the coordinator.
