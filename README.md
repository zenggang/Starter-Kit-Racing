# Starter Kit Racing

语言 / Language: [中文](#zh-cn) | [English](#english)

<a id="zh-cn"></a>

## 中文

[在线试玩](https://race.pigou.top)

这是一个基于 [Kenney Starter Kit Racing](https://github.com/KenneyNL/Starter-Kit-Racing) 的浏览器联机赛车项目。原始 Godot 赛车素材和玩法被移植到 JavaScript、Three.js 和 crashcat physics，并在外层加入移动端优先的联机大厅、房间、倒计时比赛、幽灵车、结果页和自定义赛道编辑器。

## 当前能力

- 固定入口：线上主入口使用裸域名 `https://race.pigou.top`，微信等内置浏览器全程保持同一个 URL。
- 游戏内路由：大厅、房间、比赛、结果和赛道编辑器都由内部游戏状态切换，不依赖浏览器子路由。
- 联机房间：支持创建房间、输入 4 位房间码加入、选择车身颜色、自动选色、自动准备、取消准备、设置圈数和房主发车。
- 公平开赛：房主发车后进入 coordinator 权威倒计时，所有玩家在同一个正式开赛时间点解锁输入。
- 比赛同步：本地物理仍由浏览器负责，排名、完赛、结果和幽灵车展示由 coordinator 快照驱动。
- 自定义赛道：玩家可以在 3D 赛道编辑器里创建、保存、编辑和删除自己的赛道，并在建房时选择。

## 入口说明

- `/` 是正式对外游戏入口，也是微信分享链接应使用的唯一入口。
- `/hall`、`/room/[code]`、`/race/[code]`、`/result/[code]` 和 `/track-editor` 仍保留为兼容和调试入口。
- 原始静态 `index.html` 和 `editor.html` 仍保留，用于本地运行时和编辑器兼容访问。

## 联机边界

这个项目没有把 Supabase 当作实时比赛总线，而是拆成更清晰的职责边界：

- `coordinator` 负责房间真相、比赛真相、命令排序、超时推进、排名计算、完赛和胜者决策。
- WebSocket 是主要实时通道；同源 `bridge` 是命令转发、快照恢复和移动端兼容的兜底通道。
- Next.js server routes 负责签发 ticket、代理 bridge 命令、解析自定义赛道归属，并使用服务端密钥写入持久化快照。
- Supabase 是持久化读模型，用于恢复大厅等待房间、保存玩家赛道、保留比赛结果和历史快照。

高频 `match.progress` 遥测应保留在 coordinator 内存或实时传输消息中，不要逐帧写入 Postgres。

## 持久化模型

项目当前使用三类主要持久化数据：

- `racing_rooms` 和 `racing_room_players`：大厅等待房间读模型。
- `racing_tracks`：玩家自定义赛道库。
- `racing_matches` 和 `racing_match_results`：单场比赛头信息、结果和玩家最终进度快照。

服务端和 worker 只写入 coordinator 批准过的房间生命周期、比赛头信息和最终结果。表职责、phase 语义和 RLS 预期见 `supabase/README.md`。

## 环境变量

复制 `.env.example` 后保持浏览器变量和服务端密钥分离：

- `NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`：浏览器可见，只用于大厅公开读模型和在线模式检测。
- `SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`：仅服务端或 worker 使用，用于房间生命周期、自定义赛道、比赛头信息和最终结果写入。
- `COORDINATOR_URL`：Cloudflare coordinator 地址。
- `COORDINATOR_SHARED_SECRET`：仅服务端使用，用于 ticket 签名和 bridge 转发校验。

如果 Cloudflare worker 直接写 Supabase，请把同一组服务端密钥配置到 worker secret store，不要暴露到浏览器 bundle。

## 本地开发

```bash
npm install
npm run dev
```

常用验证命令：

```bash
npm run lint
npm run test
npm run build
```

联机、默认赛道、自定义赛道、倒计时、幽灵车、结果页和 rematch 的烟测流程见 `docs/runbooks/phase-1-online-room-lifecycle.md`。

## 致谢

- 游戏素材：[Kenney](https://kenney.nl/)（CC0）
- 物理引擎：[crashcat](https://github.com/isaac-mason/crashcat)
- 原始项目：[Kenney Starter Kit Racing](https://github.com/KenneyNL/Starter-Kit-Racing)

<a id="english"></a>

## English

[Live Demo](https://race.pigou.top)

This is a browser-based online racing game built from [Kenney Starter Kit Racing](https://github.com/KenneyNL/Starter-Kit-Racing). The original Godot racing assets and gameplay have been ported to JavaScript, Three.js, and crashcat physics, then wrapped with a mobile-first online shell for the hall, rooms, authoritative countdown races, ghost cars, results, and custom track editing.

## Current Features

- Fixed entry URL: the public production entry is the bare domain `https://race.pigou.top`, so embedded browsers such as WeChat keep one stable URL for the whole game.
- Internal game navigation: hall, room, race, result, and track editor screens switch through game state instead of browser sub-routes.
- Online rooms: create a room, join with a 4-digit room code, choose vehicle color, auto-select color, auto-ready, cancel readiness, set lap count, and start as host.
- Fair start: host start enters a coordinator-authoritative countdown, and all players unlock input at the same official start time.
- Race sync: browser-local physics remains in charge of vehicle movement, while ranking, finish state, results, and ghost cars are driven by coordinator snapshots.
- Custom tracks: players can create, save, edit, and delete 3D custom tracks, then choose them during room creation.

## Entry Points

- `/` is the official public game entry and the only URL that should be used for WeChat sharing.
- `/hall`, `/room/[code]`, `/race/[code]`, `/result/[code]`, and `/track-editor` remain available for compatibility and debugging.
- The original static `index.html` and `editor.html` remain as compatibility entry points for local runtime and editor access.

## Realtime Boundary

The online stack deliberately avoids using Supabase as a live race bus. Responsibilities are split as follows:

- `coordinator` owns room truth, match truth, command ordering, timeout transitions, rank calculation, finish state, and winner decisions.
- WebSocket is the primary realtime transport. The same-origin `bridge` remains the fallback for command forwarding, snapshot recovery, and mobile compatibility.
- Next.js server routes sign tickets, proxy authenticated bridge commands, resolve custom track ownership, and persist coordinator-approved snapshots with server-only credentials.
- Supabase is the durable read-model layer for restoring hall rooms, storing player tracks, and retaining match results and historical snapshots.

High-frequency `match.progress` telemetry should stay in coordinator memory or transport messages. Do not write every frame into Postgres.

## Durable Models

The project currently uses three main durable data groups:

- `racing_rooms` and `racing_room_players`: public waiting-room read model consumed by the hall.
- `racing_tracks`: player-owned custom track library.
- `racing_matches` and `racing_match_results`: match headers, final results, and per-player final progress snapshots.

Server and worker writers persist only coordinator-approved room lifecycle snapshots, match headers, and final results. See `supabase/README.md` for table responsibilities, phase semantics, and RLS expectations.

## Environment

Copy `.env.example` and keep browser-visible variables separate from server-only secrets:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`: browser-safe values used only for public hall reads and online-mode detection.
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`: server/worker-only values used for room lifecycle, custom tracks, match headers, and final result writes.
- `COORDINATOR_URL`: Cloudflare coordinator endpoint.
- `COORDINATOR_SHARED_SECRET`: server-only secret for ticket signing and bridge forwarding.

If the Cloudflare worker writes directly to Supabase, mirror the same server-only secrets into the worker secret store instead of exposing them to the browser bundle.

## Development

```bash
npm install
npm run dev
```

Common verification commands:

```bash
npm run lint
npm run test
npm run build
```

See `docs/runbooks/phase-1-online-room-lifecycle.md` for smoke checks covering online rooms, default tracks, custom tracks, countdown, ghost cars, results, and rematch.

## Credits

- Game assets: [Kenney](https://kenney.nl/) (CC0)
- Physics engine: [crashcat](https://github.com/isaac-mason/crashcat)
- Original project: [Kenney Starter Kit Racing](https://github.com/KenneyNL/Starter-Kit-Racing)
