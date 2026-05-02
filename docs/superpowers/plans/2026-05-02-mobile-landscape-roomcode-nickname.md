# Mobile Landscape Hall And Lobby Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make hall, room, and race surfaces usable on mobile by enforcing landscape-only play, compressing the mobile HUD/layout, switching room codes to 4 digits, and letting players enter a custom nickname.

**Architecture:** Add a small viewport-orientation gate for portrait phones, keep the existing page/component structure, and concentrate layout work in `globals.css`. Room-code policy changes stay in the worker and lobby forms; nickname entry stays in the browser session layer so coordinator commands keep using the same identity contract.

**Tech Stack:** Next.js App Router, React 19, Vitest, Cloudflare Durable Objects worker, global CSS.

---

### Task 1: Lock New UX With Tests

**Files:**
- Modify: `src/session/playerSession.test.ts`
- Modify: `realtime-worker/test/roomCoordinator.test.ts`
- Create: `src/ui/viewportMode.test.ts`

- [ ] **Step 1: Add a failing nickname persistence test**

```ts
it('stores a custom nickname and reuses it for later sessions', () => {
  vi.spyOn(crypto, 'randomUUID').mockReturnValue('abcdef00-0000-0000-0000-000000000000');
  const storage = createMemoryStorage();

  setStoredNickname(storage, '  DriftKing  ');

  expect(getOrCreatePlayerSession(storage).nickname).toBe('DriftKing');
});
```

- [ ] **Step 2: Add a failing worker room-code policy test**

```ts
it('creates four-digit numeric room codes', async () => {
  const coordinator = new RoomCoordinator(new InMemoryRoomStorage(), {
    now: () => START,
    roomCodeGenerator: () => '1234'
  });

  const result = await coordinator.execute(command('room.create', 'host-1', { nickname: 'Host' }));

  expect(result.room?.code).toBe('1234');
});
```

- [ ] **Step 3: Add a failing viewport-mode helper test**

```ts
it('treats narrow portrait screens as blocked and landscape screens as playable', () => {
  expect(getViewportMode({ width: 430, height: 932 })).toBe('portrait-blocked');
  expect(getViewportMode({ width: 932, height: 430 })).toBe('landscape-playable');
});
```

- [ ] **Step 4: Run targeted tests and verify the new cases fail**

Run:

```bash
npm test -- src/session/playerSession.test.ts src/ui/viewportMode.test.ts
cd realtime-worker && npm test -- test/roomCoordinator.test.ts
```

Expected: failures for missing nickname setter, missing viewport helper, or missing 4-digit enforcement.

### Task 2: Implement Nickname + 4-Digit Room-Code Policy

**Files:**
- Modify: `src/session/playerSession.ts`
- Modify: `src/session/usePlayerSession.ts`
- Modify: `src/components/HallClient.tsx`
- Modify: `src/components/CreateRoomForm.tsx`
- Modify: `src/components/JoinRoomForm.tsx`
- Modify: `realtime-worker/src/RoomCoordinator.ts`
- Modify: `realtime-worker/src/index.ts`

- [ ] **Step 1: Add browser-side nickname persistence helpers**
- [ ] **Step 2: Expose `updateNickname()` from `usePlayerSession()`**
- [ ] **Step 3: Add a nickname input to the hall header and wire it to session storage**
- [ ] **Step 4: Restrict join-room input to 4 numeric digits**
- [ ] **Step 5: Change worker room-code generation and validation to 4 numeric digits**
- [ ] **Step 6: Re-run the targeted tests and verify they pass**

### Task 3: Implement Landscape-Only Mobile Layout

**Files:**
- Create: `src/ui/viewportMode.ts`
- Create: `src/components/LandscapeGate.tsx`
- Modify: `src/app/hall/page.tsx`
- Modify: `src/app/room/[code]/page.tsx`
- Modify: `src/app/result/[code]/page.tsx`
- Modify: `src/components/RaceClient.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Implement a tiny viewport helper and gate component**
- [ ] **Step 2: Wrap hall, room, result, and live race views with the gate**
- [ ] **Step 3: Add portrait-blocked overlay styles**
- [ ] **Step 4: Compress mobile landscape hall and room layouts**
- [ ] **Step 5: Compress mobile landscape HUD blocks so the playfield stays readable**
- [ ] **Step 6: Run targeted tests and build**

### Task 4: Verify The Full Round

**Files:**
- Verify only

- [ ] **Step 1: Run the full frontend test suite**

```bash
npm test
```

- [ ] **Step 2: Run the full worker test suite**

```bash
cd realtime-worker && npm test && npm run typecheck
```

- [ ] **Step 3: Run the production build**

```bash
npm run build
```

- [ ] **Step 4: Check formatting damage**

```bash
git diff --check
```

- [ ] **Step 5: Verify mobile landscape layouts locally**

Use Chrome or Playwright with a phone-sized landscape viewport and confirm:
- portrait shows only the rotate prompt
- hall fits nickname + create/join entry without giant headings
- room page shows room code and players without vertical overflow
- race HUD stays in corners and does not cover the center playfield
