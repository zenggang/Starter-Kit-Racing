# Racing Match Start Countdown And Input Lock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the spec-defined 15 second authoritative start countdown, central 3D-style countdown HUD, bridge/socket sync behavior, and per-player post-finish input lock before the result page transition.

**Architecture:** Keep `room.status = racing` as the route trigger, but add `match.phase = countdown` as the authority for control gating. The Durable Object owns countdown-to-live promotion and match snapshots; React derives HUD and sync behavior from match state; the legacy runtime gets a narrow input-lock contract so countdown and post-finish lock both route through the same gate.

**Tech Stack:** Next.js App Router, React, Vitest, Cloudflare Durable Objects, shared realtime protocol, legacy Three.js runtime.

---

### Task 1: Worker Countdown Authority

**Files:**
- Modify: `realtime-worker/src/protocol.ts`
- Modify: `realtime-worker/src/RoomCoordinator.ts`
- Modify: `realtime-worker/src/index.ts`
- Modify: `realtime-worker/src/realtimeBroadcast.ts`
- Test: `realtime-worker/test/roomCoordinator.test.ts`
- Test: `realtime-worker/test/realtimeBroadcast.test.ts`

- [ ] **Step 1: Write failing worker tests**

Add tests for:
- `room.start` creates `match.phase = 'countdown'`
- `match.startedAt` equals `room.startedAt + 15000ms`
- `match.sync` after countdown promotes to `live`
- socket peers receive `match.event` when countdown promotion happens

- [ ] **Step 2: Run worker tests to verify RED**

Run: `cd realtime-worker && npm test -- roomCoordinator.test.ts realtimeBroadcast.test.ts`
Expected: FAIL on missing `countdown` phase / wrong start timing / missing broadcast path

- [ ] **Step 3: Implement minimal worker countdown authority**

Core changes:
- add `countdown` to `MATCH_PHASES`
- add shared `MATCH_START_COUNTDOWN_MS = 15000`
- make `room.start` create countdown match with delayed `match.startedAt`
- promote countdown to `live` when authoritative time is reached
- schedule Durable Object alarm for the delayed start
- make alarm-triggered transition fan out a `match.event`

- [ ] **Step 4: Run worker tests to verify GREEN**

Run: `cd realtime-worker && npm test -- roomCoordinator.test.ts realtimeBroadcast.test.ts`
Expected: PASS

### Task 2: Client Countdown, HUD, And Sync

**Files:**
- Modify: `src/realtime/protocol.ts`
- Modify: `src/realtime/useMatchSession.ts`
- Modify: `src/components/RaceClient.tsx`
- Modify: `src/components/RaceHud.tsx`
- Modify: `src/game/raceTiming.ts`
- Test: `src/components/RaceClient.test.tsx`
- Test: `src/realtime/useMatchSession.test.ts`
- Test: `src/game/raceTiming.test.ts`

- [ ] **Step 1: Write failing client tests**

Add tests for:
- countdown phase renders central countdown overlay
- countdown holds timer at `00:00.000`
- bridge mode schedules an extra countdown-end `match.sync`
- local player with `finishedAt` no longer reports telemetry
- HUD shows wait-for-results state after personal finish

- [ ] **Step 2: Run client tests to verify RED**

Run: `npm test -- src/components/RaceClient.test.tsx src/realtime/useMatchSession.test.ts src/game/raceTiming.test.ts`
Expected: FAIL on missing countdown overlay / missing countdown sync / wrong timer behavior / still reporting after finish

- [ ] **Step 3: Implement minimal client countdown and waiting state**

Core changes:
- mirror `countdown` phase in client protocol
- derive countdown remaining time from authoritative `match.startedAt`
- render low-weight `15..6` prep and high-weight `5..1 / GO!` overlay
- freeze live timer until `match.phase === 'live'`
- schedule a one-shot `match.sync` at countdown end in bridge mode
- stop telemetry once local `finishedAt` exists
- show `已完赛，等待其他玩家/等待结算`

- [ ] **Step 4: Run client tests to verify GREEN**

Run: `npm test -- src/components/RaceClient.test.tsx src/realtime/useMatchSession.test.ts src/game/raceTiming.test.ts`
Expected: PASS

### Task 3: Runtime Input Gate For Countdown And Finish Lock

**Files:**
- Modify: `src/game/RacingRuntimeHost.tsx`
- Modify: `js/main.js`
- Modify: `js/Controls.js`
- Test: `js/Controls.test.ts`
- Test: `src/components/RaceClient.test.tsx`

- [ ] **Step 1: Write failing runtime/input tests**

Add tests for:
- controls can be force-disabled and return zero input
- runtime host receives the correct lock state for countdown and personal finish

- [ ] **Step 2: Run runtime tests to verify RED**

Run: `npm test -- js/Controls.test.ts src/components/RaceClient.test.tsx`
Expected: FAIL on missing lock API / controls still reading input

- [ ] **Step 3: Implement minimal runtime gate**

Core changes:
- add narrow runtime handle method such as `setInputLocked(locked)`
- let `Controls` store a forced-lock state and emit zero input when locked
- wire `RaceClient` lock state from `match.phase === 'countdown'` or `currentPlayer.finishedAt`
- keep rendering/HUD/ghost cars active while controls are locked

- [ ] **Step 4: Run runtime tests to verify GREEN**

Run: `npm test -- js/Controls.test.ts src/components/RaceClient.test.tsx`
Expected: PASS

### Task 4: Full Verification

**Files:**
- No code changes expected

- [ ] **Step 1: Run targeted app tests**

Run: `npm test -- src/components/RaceClient.test.tsx src/realtime/useMatchSession.test.ts src/game/raceTiming.test.ts js/Controls.test.ts`
Expected: PASS

- [ ] **Step 2: Run targeted worker tests**

Run: `cd realtime-worker && npm test -- roomCoordinator.test.ts realtimeBroadcast.test.ts`
Expected: PASS

- [ ] **Step 3: Run repository verification**

Run: `npm test`
Expected: PASS

Run: `npm run build`
Expected: PASS

Run: `cd realtime-worker && npm test`
Expected: PASS

Plan is saved for traceability. Execution for this request proceeds inline in the current session.
