# Track Editor Mobile Console Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework the custom track editor into a compact mobile-friendly console with a centered fixed-size map stage, compact tool controls, and a non-persistent saved-track panel.

**Architecture:** Keep the existing `TrackEditorRuntime` and track CRUD flows intact. Limit changes to `TrackEditorClient` structure, track-editor-specific CSS, and targeted component tests that lock the new layout contract.

**Tech Stack:** Next.js App Router, React 19, global CSS, Vitest, Testing Library.

---

### Task 1: Lock the new layout contract with tests

**Files:**
- Modify: `src/components/TrackEditorClient.test.tsx`
- Test: `src/components/TrackEditorClient.test.tsx`

- [ ] **Step 1: Write failing assertions for the new mobile console structure**

```tsx
it('keeps saved tracks behind an explicit panel trigger instead of always-on main layout', async () => {
  render(<TrackEditorClient />);

  await waitFor(() => {
    expect(runtimeMock.mountTrackEditorRuntime).toHaveBeenCalled();
  });

  expect(screen.getByRole('button', { name: '我的赛道' })).toBeInTheDocument();
  expect(screen.queryByText('已保存')).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/TrackEditorClient.test.tsx`
Expected: FAIL because the current component renders the saved-track section title immediately and has no explicit `我的赛道` trigger button.

- [ ] **Step 3: Add interaction coverage for the saved-track panel**

```tsx
it('opens the saved-track panel only when the track library trigger is pressed', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            ok: true,
            tracks: [{ id: 'track-1', name: '山路', trackMap: VALID_TRACK_MAP, cellCount: 8 }]
          })
        )
      )
    )
  );

  render(<TrackEditorClient />);

  await screen.findByRole('button', { name: '我的赛道' });
  expect(screen.queryByText('山路')).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: '我的赛道' }));

  expect(await screen.findByText('山路')).toBeInTheDocument();
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npm test -- src/components/TrackEditorClient.test.tsx`
Expected: FAIL because the current component has no deferred panel trigger behavior.

- [ ] **Step 5: Commit checkpoint**

```bash
git add src/components/TrackEditorClient.test.tsx
git commit -m "test: define mobile track editor console layout"
```

### Task 2: Rebuild `TrackEditorClient` into the A-compact console shell

**Files:**
- Modify: `src/components/TrackEditorClient.tsx`
- Test: `src/components/TrackEditorClient.test.tsx`

- [ ] **Step 1: Add saved-track panel state and helper actions**

```tsx
const [isTrackLibraryOpen, setIsTrackLibraryOpen] = useState(false);

function openTrackLibrary() {
  setIsTrackLibraryOpen(true);
}

function closeTrackLibrary() {
  setIsTrackLibraryOpen(false);
}
```

- [ ] **Step 2: Keep library interactions consistent with editing flows**

```tsx
function loadTrack(track: RacingTrackSummary) {
  setName(track.name);
  setEditingTrackId(track.id);
  runtimeRef.current?.setTrackMap(track.trackMap);
  setTrackMap(track.trackMap);
  setCellCount(track.cellCount);
  setMessage(null);
  setIsTrackLibraryOpen(false);
}
```

- [ ] **Step 3: Replace the main layout markup with separated tool, stage, and status rails**

```tsx
<div className="track-editor-grid">
  <section className="console-section track-editor-main track-editor-main-shell">
    <div className="track-editor-mobile-rail track-editor-tool-rail">
      ...
    </div>
    <div className="track-editor-stage-console">
      ...
    </div>
    <div className="track-editor-mobile-rail track-editor-status-rail">
      ...
    </div>
  </section>

  <aside className={isTrackLibraryOpen ? 'console-room-list track-editor-library is-open' : 'console-room-list track-editor-library'} hidden={!isTrackLibraryOpen}>
    ...
  </aside>
</div>
```

- [ ] **Step 4: Add the explicit saved-track trigger and compact hint content**

```tsx
<button
  type="button"
  className="track-editor-tool-button track-editor-library-trigger"
  onClick={openTrackLibrary}
>
  我的赛道
</button>
```

```tsx
<div className="track-editor-hint track-editor-hint-compact">
  <span>单指画路 / 擦除</span>
  <span>双指拖拽缩放</span>
  <span>点终点切方向</span>
</div>
```

- [ ] **Step 5: Run tests to verify the component behavior**

Run: `npm test -- src/components/TrackEditorClient.test.tsx`
Expected: PASS with the new trigger-driven library panel and existing tool-switch behavior still green.

- [ ] **Step 6: Commit checkpoint**

```bash
git add src/components/TrackEditorClient.tsx src/components/TrackEditorClient.test.tsx
git commit -m "feat: compact the mobile track editor shell"
```

### Task 3: Add mobile-console CSS and verify regression boundaries

**Files:**
- Modify: `src/app/globals.css`
- Test: `src/components/TrackEditorClient.test.tsx`

- [ ] **Step 1: Add track-editor-scoped compact control styles**

```css
.track-editor-tool-button,
.track-editor-save-button,
.track-editor-panel-button {
  min-height: 36px;
  min-width: 0;
  padding: 0 10px;
  font-size: 12px;
}
```

- [ ] **Step 2: Add the A-compact rail/stage layout and library panel styles**

```css
.track-editor-main-shell {
  display: grid;
  grid-template-columns: 74px minmax(0, 1fr) 122px;
  gap: 10px;
  align-items: stretch;
}

.track-editor-library[hidden] {
  display: none;
}
```

- [ ] **Step 3: Add mobile-landscape overrides that preserve a fixed-feeling central stage**

```css
@media (orientation: landscape) and (max-height: 540px) {
  .track-editor-console {
    max-width: 1120px;
  }

  .track-editor-stage-shell {
    min-height: clamp(240px, 52vh, 360px);
    aspect-ratio: 1.18;
  }
}
```

- [ ] **Step 4: Re-run the focused test suite**

Run: `npm test -- src/components/TrackEditorClient.test.tsx`
Expected: PASS.

- [ ] **Step 5: Run broader verification for the touched surface**

Run: `npm test -- src/components/TrackEditorClient.test.tsx src/components/HallClient.test.tsx`
Expected: PASS with no regression in neighboring hall flows.

- [ ] **Step 6: Commit checkpoint**

```bash
git add src/app/globals.css src/components/TrackEditorClient.tsx src/components/TrackEditorClient.test.tsx
git commit -m "style: add mobile console layout for track editor"
```
