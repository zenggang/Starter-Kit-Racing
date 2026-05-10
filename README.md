# Starter Kit Racing

语言 / Language: [中文](#zh-cn) | [English](#english)

<a id="zh-cn"></a>

## 中文

[在线试玩](https://race2.pigou.top)

这是一个基于 [Kenney Starter Kit Racing](https://github.com/KenneyNL/Starter-Kit-Racing) 的浏览器联机赛车项目。原始 Godot 赛车素材和玩法被移植到 JavaScript、Three.js 和 crashcat physics，并在外层加入移动端优先的联机大厅、房间、倒计时比赛、幽灵车、结果页和自定义赛道编辑器。当前分支的运行时目标是 `Vercel 前端 + ECS Colyseus/API + MySQL`。

## 当前能力

- 固定入口：线上主入口使用 `https://race2.pigou.top`，微信等内置浏览器全程保持同一个 URL。
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

这个项目当前按 `Vercel + ECS` 链路拆成更清晰的职责边界：

- `race2.pigou.top` 承载固定公开入口，并保持内部状态式导航，不靠浏览器 URL 切页。
- `race-online2` 负责前端页面构建与托管。
- `8.148.79.214` 负责 `Colyseus / API / MySQL`。
- `Colyseus` 负责房间真相、比赛真相、命令排序、超时推进、排名计算、完赛和胜者裁定。
- 浏览器通过同源 `/api/*` 请求数据，Next.js route handlers 再代理到 ECS 的 `https://8.148.79.214/api/*`。
- `MySQL` 负责房间读模型、自定义赛道、比赛头信息、最终结果和排行榜查询。

高频 `match.progress` 遥测应保留在 `Colyseus` 房间内存或实时消息里，不要逐帧写入 MySQL。

## 持久化模型

项目当前使用四类主要持久化数据：

- `racing_rooms` 和 `racing_room_players`：大厅等待房间读模型。
- `racing_tracks`：玩家自定义赛道库。
- `racing_matches` 和 `racing_match_results`：单场比赛头信息、结果和玩家最终进度快照。
- `players`：玩家基础标识、昵称和最近活跃时间。

后端只写入房间生命周期、比赛头信息和最终结果。部署与测试口径见：

- `docs/self-hosted-deploy.md`
- `docs/self-hosted-test-plan.md`

## 环境变量

复制 `.env.example` 后保持浏览器公开变量与 Next.js 服务器代理目标分离：

- `NEXT_PUBLIC_COLYSEUS_URL`：浏览器实时连接地址，默认 `wss://8.148.79.214/colyseus`
- `NEXT_PUBLIC_API_BASE_URL`：浏览器 API 基地址，默认同源 `/api`
- `SELF_HOSTED_SERVER_BASE_URL`：仅 Next.js server routes 使用的 backend 代理地址；本地默认 `http://127.0.0.1:2567`，Vercel 应指向 `https://8.148.79.214`

## 本地开发

```bash
npm install
npm run dev
```

本地开发分成两部分：

```bash
npm install
npm run dev
```

后端本地开发：

```bash
cd server
npm install
npm run dev
```

常用验证命令：

```bash
npm run lint
npm run test
npm run build
```

详细部署与测试流程见：

- `docs/self-hosted-deploy.md`
- `docs/self-hosted-test-plan.md`

## 致谢

- 游戏素材：[Kenney](https://kenney.nl/)（CC0）
- 物理引擎：[crashcat](https://github.com/isaac-mason/crashcat)
- 原始项目：[Kenney Starter Kit Racing](https://github.com/KenneyNL/Starter-Kit-Racing)

<a id="english"></a>

## English

[Live Demo](https://race2.pigou.top)

This is a browser-based online racing game built from [Kenney Starter Kit Racing](https://github.com/KenneyNL/Starter-Kit-Racing). The original Godot racing assets and gameplay have been ported to JavaScript, Three.js, and crashcat physics, then wrapped with a mobile-first online shell for the hall, rooms, authoritative countdown races, ghost cars, results, and custom track editing. The current branch targets a `Vercel frontend + ECS Colyseus/API + MySQL` runtime.

## Current Features

- Fixed entry URL: the public production entry is `https://race2.pigou.top`, so embedded browsers such as WeChat keep one stable URL for the whole game.
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

The current `Vercel + ECS` stack splits responsibilities as follows:

- `race2.pigou.top` is the fixed public web entry.
- `race-online2` hosts the frontend.
- `8.148.79.214` hosts the realtime/API/database backend.
- `Colyseus` owns room truth, match truth, command ordering, timeout transitions, ranking, finish state, and winner decisions.
- The browser uses same-origin `/api/*` endpoints in production, and Next.js route handlers forward those requests to `https://8.148.79.214/api/*`.
- `MySQL` stores hall projections, track library rows, match headers, final results, and leaderboard queries.

High-frequency `match.progress` telemetry stays in `Colyseus` room memory or transport messages. Do not write every frame into MySQL.

## Durable Models

The project currently uses four main durable data groups:

- `racing_rooms` and `racing_room_players`: public waiting-room read model consumed by the hall.
- `racing_tracks`: player-owned custom track library.
- `racing_matches` and `racing_match_results`: match headers, final results, and per-player final progress snapshots.
- `players`: player identity, nickname, and recent activity.

See `docs/self-hosted-deploy.md` and `docs/self-hosted-test-plan.md` for deployment and verification details.

## Environment

Copy `.env.example` and keep browser-visible variables separate from the Next.js server-side proxy target:

- `NEXT_PUBLIC_COLYSEUS_URL`: browser realtime endpoint, default `wss://8.148.79.214/colyseus`
- `NEXT_PUBLIC_API_BASE_URL`: browser API base URL, default `/api`
- `SELF_HOSTED_SERVER_BASE_URL`: server-only proxy target for Next.js routes; local default `http://127.0.0.1:2567`, Vercel target `https://8.148.79.214`

## Development

```bash
npm install
npm run dev
```

Frontend development:

```bash
npm install
npm run dev
```

Backend development:

```bash
cd server
npm install
npm run dev
```

Common verification commands:

```bash
npm run lint
npm run test
npm run build
```

See `docs/self-hosted-deploy.md` and `docs/self-hosted-test-plan.md` for deployment and smoke checks.

## Credits

- Game assets: [Kenney](https://kenney.nl/) (CC0)
- Physics engine: [crashcat](https://github.com/isaac-mason/crashcat)
- Original project: [Kenney Starter Kit Racing](https://github.com/KenneyNL/Starter-Kit-Racing)
