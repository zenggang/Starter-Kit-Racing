# Room Lobby Landscape Density Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 压缩房间页横屏布局，并让玩家进入房间时自动获得首个可用车身颜色。

**Architecture:** 房间规则改动收敛在 `RoomCoordinator`，由协调器在建房和进房时分配默认颜色；房间页 UI 改动收敛在 `RoomLobbyPanel`、`ColorPicker` 和 `globals.css`，复用现有比赛页 minimap 视觉语义，在不重构页面路由的前提下完成双列紧凑布局。

**Tech Stack:** Next.js App Router, React 19, TypeScript, Vitest, Testing Library, CSS in `src/app/globals.css`

---

### Task 1: 锁定自动配色行为

**Files:**
- Modify: `realtime-worker/test/roomCoordinator.test.ts`
- Modify: `realtime-worker/src/RoomCoordinator.ts`

- [ ] 为建房和进房补失败测试，断言房主和后来加入的玩家会自动拿到当前首个可用颜色，且重复 join 不会覆盖已有颜色。
- [ ] 运行 `npm test -- realtime-worker/test/roomCoordinator.test.ts`，确认新用例先失败。
- [ ] 在 `RoomCoordinator` 中补充默认颜色分配 helper，并在 `createRoom` / `joinRoom` 路径上接入。
- [ ] 再次运行 `npm test -- realtime-worker/test/roomCoordinator.test.ts`，确认房间规则测试转绿。

### Task 2: 锁定房间页结构和文案

**Files:**
- Modify: `src/components/RoomLobbyPanel.test.tsx`
- Modify: `src/components/RoomLobbyPanel.tsx`
- Modify: `src/components/ColorPicker.tsx`
- Modify: `src/components/LapTargetControl.tsx`

- [ ] 为房间页补失败测试，覆盖紧凑颜色行、赛道预览、核心按钮区和更短状态文案。
- [ ] 运行 `npm test -- src/components/RoomLobbyPanel.test.tsx`，确认新断言先失败。
- [ ] 重排 `RoomLobbyPanel` 结构：左列头部放颜色条，左列主体放 2x2 车手席，右列放 minimap / 圈数 / 操作。
- [ ] 把 `ColorPicker` 改成支持紧凑色块模式；同步把圈数控件容器语义保持紧凑。
- [ ] 再次运行 `npm test -- src/components/RoomLobbyPanel.test.tsx`，确认组件测试转绿。

### Task 3: 收紧横屏样式

**Files:**
- Modify: `src/app/globals.css`

- [ ] 依据已确认 mockup 压缩左列头部高度、车手卡高度、2x2 间距和右列按钮尺寸。
- [ ] 为横屏和微信紧凑模式分别补充更激进的缩放规则，保证手机横屏首屏信息完整。
- [ ] 运行 `npm test -- src/components/RoomLobbyPanel.test.tsx`，确认样式相关 DOM 结构未破坏测试。

### Task 4: 整体验证

**Files:**
- Verify only: `package.json` scripts, running app in browser

- [ ] 运行 `npm test`，确认仓库测试整体通过或明确列出失败范围。
- [ ] 运行 `npm run dev`，打开房间页进行桌面和手机横屏验证，检查自动配色、布局密度和按钮区留白。
- [ ] 对照已确认 concept 做最终视觉检查，修正明显的间距、尺寸和文案漂移。
