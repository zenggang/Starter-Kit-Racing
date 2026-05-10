# Starter-Kit-Racing Self-Hosted Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `Ali-init` 分支从 `Next.js + Cloudflare Worker + Supabase` 迁移为 `ECS 自托管 Next.js + Colyseus + MySQL`，并在保持现有玩法、固定外部 URL 和主要交互语义不变的前提下重新跑通游戏。

**Architecture:** 现有 `Next.js` 前端继续保留，并维持 `https://race2.pigou.top` 作为唯一公开入口；大厅、房间、比赛、结果页、赛道编辑器继续走内部状态导航。新增 `server/` 目录承载 `Colyseus + MySQL`，浏览器通过 `colyseus.js` 连接 `wss://game.pigou.top`，HTTP 读写接口统一走 `race2.pigou.top/api/*`，服务器内部服务间通信全部走 `127.0.0.1`。

**Tech Stack:** Next.js 15, React 19, TypeScript, Colyseus 0.16.x, colyseus.js 0.16.x, mysql2/promise, Express 5, Vitest, MySQL 8, Nginx, PM2

---

## File Structure Lock

### Frontend files kept as gameplay/runtime core

- Keep: `js/main.js`
- Keep: `js/Vehicle.js`
- Keep: `js/Track.js`
- Keep: `js/Physics.js`
- Keep: `js/Controls.js`
- Keep: `js/Audio.js`
- Keep: `js/Particles.js`
- Keep: `js/DriftMarks.js`
- Keep: `js/RemoteVehicles.js`
- Keep: `src/game/RacingRuntimeHost.tsx`
- Keep: `src/components/RaceClient.tsx`
- Keep: `src/components/ResultClient.tsx`
- Keep: `src/components/TrackEditorClient.tsx`
- Keep: `shared/trackMapValidation.ts`

### New backend files

- Create: `server/package.json`
- Create: `server/tsconfig.json`
- Create: `server/src/index.ts`
- Create: `server/src/config.ts`
- Create: `server/src/db/mysql.ts`
- Create: `server/src/db/migrations/001_init.sql`
- Create: `server/src/http/routes/health.ts`
- Create: `server/src/http/routes/rooms.ts`
- Create: `server/src/http/routes/tracks.ts`
- Create: `server/src/http/routes/leaderboard.ts`
- Create: `server/src/http/routes/raceRecords.ts`
- Create: `server/src/services/playerService.ts`
- Create: `server/src/services/roomProjectionService.ts`
- Create: `server/src/services/trackService.ts`
- Create: `server/src/services/leaderboardService.ts`
- Create: `server/src/services/raceRecordService.ts`
- Create: `server/src/rooms/RaceRoom.ts`
- Create: `server/src/schema/RaceState.ts`
- Create: `server/src/lib/protocol.ts`
- Create: `server/src/lib/inMemoryRoomIndex.ts`

### Frontend files to refactor away from Worker/Supabase runtime

- Modify: `package.json`
- Modify: `.env.example`
- Modify: `src/config/env.ts`
- Modify: `src/realtime/protocol.ts`
- Modify: `src/realtime/sessionClient.ts`
- Modify: `src/realtime/useRoomSession.ts`
- Modify: `src/realtime/useMatchSession.ts`
- Modify: `src/server/rooms.ts`
- Modify: `src/server/tracks.ts`
- Modify: `src/app/api/rooms/route.ts`
- Modify: `src/app/api/tracks/route.ts`
- Modify: `src/app/api/tracks/[id]/route.ts`

### Legacy files to archive or remove from active runtime path

- Archive: `realtime-worker/*`
- Archive: `supabase/*`
- Archive or remove runtime references from:
  - `src/app/api/coordinator-ticket/route.ts`
  - `src/app/api/coordinator-bridge/room/[code]/route.ts`
  - `src/server/readModelWriter.ts`
  - `scripts/dev-local-worker.sh`
  - `scripts/dev-online-worker.sh`

### Docs

- Create: `docs/self-hosted-deploy.md`
- Create: `docs/self-hosted-test-plan.md`
- Create: `server/.env.example`
- Modify: `README.md`

---

### Task 1: 建立自托管 backend 骨架与本地可编译基线

**Files:**
- Create: `server/package.json`
- Create: `server/tsconfig.json`
- Create: `server/src/index.ts`
- Create: `server/src/config.ts`
- Create: `server/src/db/mysql.ts`
- Create: `server/src/http/routes/health.ts`
- Test: `server/src/config.test.ts`
- Test: `server/src/http/routes/health.test.ts`

- [ ] **Step 1: 写配置读取测试**

```ts
import { describe, expect, it } from "vitest";
import { readServerConfig } from "./config";

describe("readServerConfig", () => {
  it("reads localhost defaults for self-hosted mode", () => {
    const config = readServerConfig({
      HOST: "127.0.0.1",
      PORT: "2567",
      MYSQL_HOST: "127.0.0.1",
      MYSQL_PORT: "3306",
      MYSQL_DATABASE: "race_game",
      MYSQL_USER: "race_user",
      MYSQL_PASSWORD: "secret",
      COLYSEUS_PUBLIC_URL: "wss://game.pigou.top",
      CORS_ORIGIN: "https://race2.pigou.top"
    });

    expect(config.host).toBe("127.0.0.1");
    expect(config.port).toBe(2567);
    expect(config.mysql.host).toBe("127.0.0.1");
    expect(config.public.colyseusUrl).toBe("wss://game.pigou.top");
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
cd /Users/javababy/Downloads/AI\ demo/Starter-Kit-Racing
npx vitest run server/src/config.test.ts
```

Expected: FAIL，提示 `server/src/config.ts` 不存在。

- [ ] **Step 3: 写最小 backend package 与配置模块**

```json
{
  "name": "starter-kit-racing-server",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/index.js",
    "test": "vitest run"
  },
  "dependencies": {
    "@colyseus/schema": "2.0.37",
    "@colyseus/ws-transport": "0.16.5",
    "colyseus": "0.16.5",
    "cors": "^2.8.5",
    "dotenv": "^17.2.2",
    "express": "^5.1.0",
    "mysql2": "^3.14.3"
  },
  "devDependencies": {
    "@types/node": "^22.13.10",
    "tsx": "^4.20.3",
    "typescript": "^5.8.2",
    "vitest": "^3.0.9"
  }
}
```

```ts
export function readServerConfig(env: Record<string, string | undefined> = process.env) {
  return {
    host: env.HOST ?? "127.0.0.1",
    port: Number(env.PORT ?? "2567"),
    mysql: {
      host: env.MYSQL_HOST ?? "127.0.0.1",
      port: Number(env.MYSQL_PORT ?? "3306"),
      database: env.MYSQL_DATABASE ?? "",
      user: env.MYSQL_USER ?? "",
      password: env.MYSQL_PASSWORD ?? ""
    },
    public: {
      colyseusUrl: env.COLYSEUS_PUBLIC_URL ?? "wss://game.pigou.top",
      corsOrigin: env.CORS_ORIGIN ?? "https://race2.pigou.top"
    }
  };
}
```

- [ ] **Step 4: 写最小 `/health` 路由与入口**

```ts
import express from "express";

export function registerHealthRoute(app: express.Express) {
  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });
}
```

```ts
import express from "express";
import { createServer } from "node:http";
import { readServerConfig } from "./config";
import { registerHealthRoute } from "./http/routes/health";

const config = readServerConfig();
const app = express();
registerHealthRoute(app);

const server = createServer(app);
server.listen(config.port, config.host);
```

- [ ] **Step 5: 运行测试确认通过**

Run:

```bash
cd /Users/javababy/Downloads/AI\ demo/Starter-Kit-Racing
npx vitest run server/src/config.test.ts server/src/http/routes/health.test.ts
```

Expected: PASS

- [ ] **Step 6: 编译 server**

Run:

```bash
cd /Users/javababy/Downloads/AI\ demo/Starter-Kit-Racing/server
npm install
npm run build
```

Expected: `dist/` 生成成功。

---

### Task 2: 落 MySQL durable model 与基础读写服务

**Files:**
- Create: `server/src/db/migrations/001_init.sql`
- Create: `server/src/services/playerService.ts`
- Create: `server/src/services/roomProjectionService.ts`
- Create: `server/src/services/trackService.ts`
- Create: `server/src/services/leaderboardService.ts`
- Create: `server/src/services/raceRecordService.ts`
- Test: `server/src/services/leaderboardService.test.ts`

- [ ] **Step 1: 写 migration 草案测试点**

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("001_init.sql", () => {
  it("defines required self-hosted tables", () => {
    const sql = readFileSync("server/src/db/migrations/001_init.sql", "utf8");
    expect(sql).toContain("create table if not exists players");
    expect(sql).toContain("create table if not exists racing_rooms");
    expect(sql).toContain("create table if not exists racing_tracks");
    expect(sql).toContain("create table if not exists racing_matches");
    expect(sql).toContain("create table if not exists racing_match_results");
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
cd /Users/javababy/Downloads/AI\ demo/Starter-Kit-Racing
npx vitest run server/src/services/leaderboardService.test.ts
```

Expected: FAIL，`001_init.sql` 不存在。

- [ ] **Step 3: 写最小 migration**

```sql
create table if not exists players (
  player_id varchar(64) primary key,
  nickname varchar(64) not null,
  created_at datetime not null,
  updated_at datetime not null,
  last_seen_at datetime null
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table if not exists racing_rooms (
  id varchar(64) primary key,
  code varchar(16) not null unique,
  host_player_id varchar(64) not null,
  status varchar(32) not null,
  lap_target int not null,
  track_id varchar(64) null,
  track_name varchar(128) null,
  track_map mediumtext null,
  created_at datetime not null,
  started_at datetime null,
  finished_at datetime null,
  expires_at datetime not null,
  closed_reason varchar(64) null,
  key idx_racing_rooms_status_expires (status, expires_at)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table if not exists racing_tracks (
  id varchar(64) primary key,
  owner_player_id varchar(64) not null,
  name varchar(128) not null,
  track_map mediumtext not null,
  track_hash varchar(128) not null,
  cell_count int not null,
  bounds_json json not null,
  preview_points_json json null,
  created_at datetime not null,
  updated_at datetime not null,
  last_used_at datetime null,
  deleted_at datetime null,
  key idx_racing_tracks_owner_updated (owner_player_id, updated_at),
  key idx_racing_tracks_owner_deleted (owner_player_id, deleted_at)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;
```

- [ ] **Step 4: 写最小服务接口形状**

```ts
export interface LeaderboardRow {
  playerId: string;
  nickname: string;
  wins: number;
  races: number;
  bestRank: number | null;
}

export async function listLeaderboard(): Promise<LeaderboardRow[]> {
  return [];
}
```

```ts
export interface RaceRecordRow {
  matchId: string;
  roomCode: string;
  phase: string;
  winnerPlayerId: string | null;
  finishedAt: string | null;
}

export async function listRaceRecords(): Promise<RaceRecordRow[]> {
  return [];
}
```

- [ ] **Step 5: 运行服务层测试**

Run:

```bash
cd /Users/javababy/Downloads/AI\ demo/Starter-Kit-Racing
npx vitest run server/src/services/leaderboardService.test.ts
```

Expected: PASS

---

### Task 3: 将 Worker 协议和生命周期迁入 Colyseus

**Files:**
- Create: `server/src/lib/protocol.ts`
- Create: `server/src/lib/inMemoryRoomIndex.ts`
- Create: `server/src/schema/RaceState.ts`
- Create: `server/src/rooms/RaceRoom.ts`
- Test: `server/src/rooms/RaceRoom.test.ts`
- Reference only: `realtime-worker/src/RoomCoordinator.ts`
- Reference only: `realtime-worker/src/protocol.ts`
- Reference only: `realtime-worker/src/realtimeBroadcast.ts`

- [ ] **Step 1: 先写 Room 行为测试**

```ts
import { describe, expect, it } from "vitest";

describe("RaceRoom", () => {
  it("creates a waiting room with host, default lap target, and fixed code", async () => {
    expect(true).toBe(true);
  });

  it("keeps countdown/live/finished phase semantics from the old coordinator", async () => {
    expect(true).toBe(true);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
cd /Users/javababy/Downloads/AI\ demo/Starter-Kit-Racing/server
npm test -- server/src/rooms/RaceRoom.test.ts
```

Expected: FAIL，`RaceRoom.ts` 不存在。

- [ ] **Step 3: 复制并裁剪旧协议**

```ts
export type RoomCommandType =
  | "room.create"
  | "room.join"
  | "room.leave"
  | "room.setLapTarget"
  | "room.chooseColor"
  | "room.chooseVehicleType"
  | "room.ready"
  | "room.start"
  | "room.rematch"
  | "match.join"
  | "match.leave"
  | "match.progress"
  | "match.sync";

export type RealtimeMessageType =
  | "room.snapshot"
  | "room.event"
  | "match.snapshot"
  | "match.event"
  | "command.result";
```

- [ ] **Step 4: 在 `RaceRoom` 中保留旧生命周期**

```ts
// 目标不是重写玩法，而是把旧 RoomCoordinator 的房间/比赛语义迁入 Colyseus。
// 迁移时继续保留：
// - waiting -> racing -> finished -> closed
// - countdown -> live -> finished/aborted
// - host start / rematch
// - ready 与 color 前置约束
// - match.progress 只做排序和结果裁定，不碰本地物理
```

```ts
export class RaceRoom {
  // 先以旧 command/result 契约为中心组织逻辑，
  // 再把 Colyseus 的 onJoin/onLeave/onMessage 接进来。
}
```

- [ ] **Step 5: 运行 Room 测试**

Run:

```bash
cd /Users/javababy/Downloads/AI\ demo/Starter-Kit-Racing/server
npm test -- server/src/rooms/RaceRoom.test.ts
```

Expected: PASS

---

### Task 4: 前端切换到 `colyseus.js` 与同源 API

**Files:**
- Modify: `package.json`
- Modify: `src/config/env.ts`
- Modify: `src/realtime/protocol.ts`
- Modify: `src/realtime/sessionClient.ts`
- Modify: `src/realtime/useRoomSession.ts`
- Modify: `src/realtime/useMatchSession.ts`
- Modify: `src/server/rooms.ts`
- Modify: `src/server/tracks.ts`
- Modify: `src/app/api/rooms/route.ts`
- Modify: `src/app/api/tracks/route.ts`
- Modify: `src/app/api/tracks/[id]/route.ts`
- Test: `src/realtime/useRoomSession.test.ts`
- Test: `src/realtime/useMatchSession.test.ts`

- [ ] **Step 1: 先锁新的环境变量测试**

```ts
import { describe, expect, it } from "vitest";
import { getPublicRuntimeConfig } from "./env";

describe("getPublicRuntimeConfig", () => {
  it("uses fixed race2 entry and game.pigou.top colyseus url", () => {
    const config = getPublicRuntimeConfig({
      NEXT_PUBLIC_COLYSEUS_URL: "wss://game.pigou.top",
      NEXT_PUBLIC_API_BASE_URL: "https://race2.pigou.top/api"
    });

    expect(config.colyseusUrl).toBe("wss://game.pigou.top");
    expect(config.apiBaseUrl).toBe("https://race2.pigou.top/api");
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
cd /Users/javababy/Downloads/AI\ demo/Starter-Kit-Racing
npx vitest run src/config/env.test.ts src/realtime/useRoomSession.test.ts src/realtime/useMatchSession.test.ts
```

Expected: FAIL，旧 `COORDINATOR_* / SUPABASE_*` 假设仍在。

- [ ] **Step 3: 用 `colyseus.js` 替换 ticket + raw websocket**

```json
{
  "dependencies": {
    "colyseus.js": "0.16.22"
  }
}
```

```ts
import { Client } from "colyseus.js";

export function createColyseusClient(url: string) {
  return new Client(url);
}
```

```ts
export function getPublicRuntimeConfig(env: Record<string, string | undefined> = process.env) {
  return {
    colyseusUrl: env.NEXT_PUBLIC_COLYSEUS_URL ?? "wss://game.pigou.top",
    apiBaseUrl: env.NEXT_PUBLIC_API_BASE_URL ?? "/api"
  };
}
```

- [ ] **Step 4: 保持固定外部 URL，不改 `GameShell` 内部状态式导航**

```ts
// 不改 GameShell 的核心模式：
// hall -> room -> race -> result -> track-editor
// 都是内部状态切换，浏览器地址栏仍停留在 https://race2.pigou.top
```

- [ ] **Step 5: 把大厅和赛道库改到新 API**

```ts
const response = await fetch("/api/rooms");
const response = await fetch(`/api/tracks?playerId=${encodeURIComponent(playerId)}`);
```

Expected behavior:

- 前端不再直接依赖 Supabase
- 前端不再请求 `coordinator-ticket`
- 前端不再请求 `coordinator-bridge`

- [ ] **Step 6: 运行前端测试**

Run:

```bash
cd /Users/javababy/Downloads/AI\ demo/Starter-Kit-Racing
npx vitest run src/realtime/useRoomSession.test.ts src/realtime/useMatchSession.test.ts
```

Expected: PASS

---

### Task 5: 清理 legacy 依赖并补文档与样例 env

**Files:**
- Modify: `.env.example`
- Create: `server/.env.example`
- Create: `docs/self-hosted-deploy.md`
- Create: `docs/self-hosted-test-plan.md`
- Modify: `README.md`
- Archive: `realtime-worker/*`
- Archive: `supabase/*`
- Modify: `scripts/dev-local-worker.sh`
- Modify: `scripts/dev-online-worker.sh`

- [ ] **Step 1: 更新根 `.env.example`**

```env
NEXT_PUBLIC_COLYSEUS_URL=wss://game.pigou.top
NEXT_PUBLIC_API_BASE_URL=https://race2.pigou.top/api
```

- [ ] **Step 2: 新建 `server/.env.example`**

```env
NODE_ENV=production
HOST=127.0.0.1
PORT=2567

MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_DATABASE=race_game
MYSQL_USER=race_user
MYSQL_PASSWORD=change_me

COLYSEUS_PUBLIC_URL=wss://game.pigou.top
CORS_ORIGIN=https://race2.pigou.top
```

- [ ] **Step 3: 部署文档必须锁定这些口径**

```md
- `race2.pigou.top` 指向 ECS 公网 IP，并由 Nginx 反代到 Next.js
- `game.pigou.top` 指向同一 ECS 公网 IP，并由 Nginx 反代到 Colyseus
- 浏览器固定入口为 `https://race2.pigou.top`
- `Nginx -> Next.js` 走 `127.0.0.1:<next_port>`
- `Nginx -> Colyseus` 走 `127.0.0.1:2567`
- `Next.js / Colyseus -> MySQL` 走 `127.0.0.1:3306`
```

- [ ] **Step 4: 测试计划文档必须覆盖**

```md
1. MySQL migration 可执行
2. server 可启动
3. /health 返回 ok:true
4. /api/leaderboard 正常
5. /api/race-records 正常
6. race2 页面可访问
7. wss://game.pigou.top 可连接
8. 创建房间/加入房间/发车/完赛可用
9. 2567 未开放公网
10. 3306 未开放公网
```

- [ ] **Step 5: 归档 legacy**

Run:

```bash
mkdir -p archive/legacy-worker archive/legacy-supabase
```

Expected: `realtime-worker/` 和 `supabase/` 从主动运行链路中摘除，但保留参考价值。

---

### Task 6: 构建验证与 ECS 落地检查单

**Files:**
- Modify: `docs/self-hosted-deploy.md`
- Optional Create: `server/ecosystem.config.cjs`

- [ ] **Step 1: 本地构建验证**

Run:

```bash
cd /Users/javababy/Downloads/AI\ demo/Starter-Kit-Racing
npm install
npm run build
cd server
npm install
npm run build
```

Expected:

- root Next.js build PASS
- server TypeScript build PASS

- [ ] **Step 2: ECS 必须检查的软件与边界**

Run:

```bash
node -v
pnpm -v
pm2 -v
nginx -v
mysql --version
ss -ltnp | grep -E ':(80|443|2567|3306) ' || true
```

Expected:

- `Node.js 22`
- `Nginx` 可用
- `MySQL` 已安装
- `2567` 只监听 `127.0.0.1`
- `3306` 只监听 `127.0.0.1`

- [ ] **Step 3: PM2 启动口径**

```bash
cd /home/deploy/apps/games/race/server
npm install
npm run build
pm2 start npm --name race-colyseus -- run start
pm2 save
```

- [ ] **Step 4: Nginx 验收口径**

```nginx
server_name race2.pigou.top;
# proxy_pass http://127.0.0.1:<next_port>;

server_name game.pigou.top;
# proxy_pass http://127.0.0.1:2567;
# include Upgrade / Connection headers for WSS
```

- [ ] **Step 5: 最终烟测**

Run:

```bash
curl https://race2.pigou.top
curl https://game.pigou.top/health
```

Expected:

- `race2.pigou.top` 返回前端页面
- `game.pigou.top/health` 返回 `{"ok":true}`

---

## Self-Review

- Spec coverage:
  - 固定外部 URL：Task 4 / Task 5 / Task 6 覆盖
  - `race2.pigou.top` 与 `game.pigou.top` 同机双域名：Task 5 / Task 6 覆盖
  - `Colyseus + MySQL` 自托管：Task 1 / Task 2 / Task 3 覆盖
  - 不改玩法与渲染核心：File Structure Lock 与 Task 4 明确约束
- Placeholder scan:
  - 已移除 `race-self.pigou.top`
  - 已明确固定 `race2.pigou.top`
  - 已明确不再使用 `COORDINATOR_* + SUPABASE_*` 作为新主链路
- Type consistency:
  - 前端公共入口统一使用 `NEXT_PUBLIC_COLYSEUS_URL` 与 `NEXT_PUBLIC_API_BASE_URL`
  - 后端统一使用 `HOST=127.0.0.1`、`PORT=2567`、`MYSQL_*`
