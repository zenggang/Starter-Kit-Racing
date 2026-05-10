# Starter-Kit-Racing 自托管架构迁移 Spec

> superseded: 本文档已被 [docs/specs/2026-05-10-vercel-frontend-ecs-realtime-ip-spec.md](/Users/javababy/Downloads/AI%20demo/Starter-Kit-Racing/docs/specs/2026-05-10-vercel-frontend-ecs-realtime-ip-spec.md:1) 取代。
> 原因：`2026-05-10` 起迁移方向调整为“Vercel 前端 + ECS 实时/API + MySQL”，不再采用 “ECS 自托管前端” 方案。

日期：`2026-05-09`
状态：`draft-for-review`
分支：`Ali-init`

## 1. 背景

当前仓库已经不是“纯静态网页赛车 demo”，而是一个已经接入在线房间、比赛倒计时、幽灵车、自定义赛道、结果页的在线赛车项目。

现状运行链路是：

- 前端：`Next.js App Router`
- 实时层：`Cloudflare Worker / Durable Objects`
- 持久化：`Supabase`
- 部署口径：偏 `Vercel + Worker + Supabase`

这与本分支目标不一致。本分支目标是把运行时基础设施改造成“阿里云单机自托管”体系，同时尽量保留现有玩法、渲染、资源、赛车逻辑和交互体验。

## 2. 目标

将项目迁移到同一台阿里云 ECS 的自托管体系，使新链路摆脱：

- `Vercel` 作为运行时依赖
- `Cloudflare Worker / Durable Objects` 作为实时运行时依赖
- `Supabase` 作为运行时持久化依赖

并让游戏在新体系下重新跑起来。

## 3. 关键纠偏

### 3.1 不再把“静态 dist”作为硬约束

原 prompt 中“前端必须改成 Nginx 直接托管 `dist`”这一点，不适合作为本项目这一轮迁移的硬约束。

原因：

- 当前真实前端不是 `Vite SPA`，而是 `Next.js App Router` 项目。
- 当前仓库存在多个调试/兼容路由与客户端状态壳，直接强推静态 `dist` 会引入额外前端重构，而不是单纯基础设施迁移。
- 这轮迁移的核心目标是替换运行时基础设施，不是重写前端框架。

因此本轮正确策略是：

- 前端保留 `Next.js`，但改为 **ECS 自托管**。
- `Nginx` 不再托管纯静态 `dist`，而是反代到自托管的 `Next.js` 进程。

### 3.2 运行时 API 与实时服务拆开，但都放在 ECS

本轮架构拆分为：

- `race2.pigou.top`：用户访问的前端站点，Nginx 反代到 `Next.js`
- `game.pigou.top`：实时连接入口，Nginx 反代到 `Colyseus`
- MySQL：仅本机监听，由 `Next.js` 或 `Colyseus` 所属的 Node 服务端访问

### 3.3 对外固定 URL，不靠浏览器路由切页

对外公开游戏入口固定为：

- `https://race2.pigou.top`

约束：

- 用户从进入游戏到大厅、房间、比赛、结果页、赛道编辑器的全部流程，浏览器地址栏保持 `https://race2.pigou.top`
- 页面切换继续沿用现有内部状态式导航思路，不把 `/room/[code]`、`/race/[code]`、`/result/[code]` 作为用户主链路公开 URL
- 现有调试路由是否保留，可以作为兼容或开发入口存在，但不作为正式对外入口

## 4. 范围

### 4.1 In Scope

- 前端从 Vercel 迁移为 ECS 自托管 `Next.js`
- 实时层从 `Cloudflare Worker / Durable Objects` 迁移为 `Colyseus`
- 持久化从 `Supabase` 迁移为 `MySQL`
- 新增独立 `server/` 目录承载 `Colyseus + MySQL`
- 前端改为连接新实时链路和新 API
- 新增部署文档、测试文档、环境变量样例
- ECS 安装并配置迁移后真正需要的环境

### 4.2 Out of Scope

- 不改赛车玩法设计
- 不重写 `js/*` 里的物理、渲染、地图、资源装载逻辑
- 不改美术、音频、模型、赛道资源
- 不新增账号体系、第三方登录、复杂权限系统
- 不做老 Supabase 线上数据回灌
- 不兼容老 Worker/Supabase 运行时
- 不动老分支线上链路

## 5. 新架构

### 5.1 前端

前端继续使用当前 `Next.js` 项目，不改框架，只改部署方式和运行时依赖。

职责：

- 渲染大厅、房间、比赛、结果页、赛道编辑器
- 挂载现有 `Three.js + crashcat` 赛车运行时
- 通过 `colyseus.js` 连接实时房间
- 通过新的 HTTP API 读取：
  - 大厅房间列表
  - 自定义赛道库
  - 排行榜
  - 比赛记录

### 5.2 实时服务

新增 `server/` 目录，使用：

- `TypeScript`
- `Colyseus`
- `mysql2/promise`

职责：

- 提供 `race_room`
- 承接当前房间/比赛生命周期语义
- 接收比赛 telemetry
- 产出房间真相、比赛真相、结果真相
- 将最终需要持久化的快照写入 MySQL
- 提供基础 HTTP 接口：
  - `/health`
  - `/api/rooms`
  - `/api/tracks`
  - `/api/leaderboard`
  - `/api/race-records`

### 5.3 数据层

MySQL 承接原 Supabase durable model，负责：

- 房间大厅读模型
- 房间成员读模型
- 玩家自定义赛道库
- 比赛头信息
- 比赛最终结果
- 排行榜查询

高频实时 telemetry 不写 MySQL。

### 5.4 Redis 评估结论

本轮迁移 **可以引入 Redis**，但当前建议是：

- **第一阶段不把 Redis 作为必选依赖**
- 先用 `Colyseus + 进程内内存 + MySQL` 跑通新链路
- Redis 保留为后续性能优化或扩展能力位

原因：

- 当前目标是单机 ECS 自托管，不是多机水平扩容
- `Colyseus` 房间实时状态本来就应主要停留在内存中，而不是频繁查 MySQL
- `Next.js / Colyseus / MySQL` 都在同一台机器上，服务间已走 `127.0.0.1`，相比旧链路，主要性能收益首先来自“去掉跨公网的 Vercel / Worker / Supabase 往返”
- 如果第一阶段同时引入 Redis，会增加额外安装、运维、持久化策略、故障恢复和数据一致性复杂度，不利于先把主链路跑通

因此本 spec 的当前结论是：

- Redis 不作为第一阶段上线阻塞项
- 如果后续压测或线上观察表明有必要，再把 Redis 作为第二阶段增强

Redis 在后续阶段的合理用途包括：

- 大厅房间列表缓存
- 排行榜缓存
- 短期票据或重连 token 缓存
- 多 Node/多 Colyseus 进程之间的 pub/sub
- 限流与短 TTL 状态缓存

## 6. 需要保留的代码

这轮迁移默认保留以下核心代码，不把它们当重写对象：

- `js/main.js`
- `js/Vehicle.js`
- `js/Track.js`
- `js/Physics.js`
- `js/Controls.js`
- `js/Audio.js`
- `js/Particles.js`
- `js/DriftMarks.js`
- `js/RemoteVehicles.js`
- `src/game/*`
- `shared/trackMapValidation.ts`
- `src/components/RaceClient.tsx`
- `src/components/ResultClient.tsx`
- `src/components/TrackEditorClient.tsx`

原则：

- 只在接入新架构所必需的地方做小范围适配
- 不借迁移之名顺手重写玩法或 UI 语义

## 7. 需要替换的旧依赖

以下属于旧架构依赖，本轮目标是从运行时主链路中摘除：

- `realtime-worker/`
- `supabase/`
- `src/app/api/coordinator-ticket`
- `src/app/api/coordinator-bridge`
- `src/server/readModelWriter.ts` 中面向 Supabase 的实现
- `src/server/rooms.ts` 中面向 Supabase 的大厅读取
- `src/server/tracks.ts` 中面向 Supabase 的赛道库读写
- `COORDINATOR_* + SUPABASE_*` 这一套旧运行时环境变量

保留这些目录/文件的前提仅限：

- 作为迁移参考
- 作为 legacy 归档

不能再作为新分支生产链路依赖。

## 8. 目录目标

本轮迁移后，新增或整理出如下后端目录：

```text
server/
  package.json
  tsconfig.json
  .env.example
  src/
    index.ts
    config.ts
    rooms/
      RaceRoom.ts
    schema/
      RaceState.ts
    db/
      mysql.ts
      migrations/
        001_init.sql
    http/
      routes/
        health.ts
        rooms.ts
        tracks.ts
        leaderboard.ts
        raceRecords.ts
    services/
      leaderboardService.ts
      raceRecordService.ts
      trackService.ts
      roomProjectionService.ts
```

## 9. MySQL 目标 schema

目标不是照抄 Supabase DDL，而是承接同一组业务职责。

### 9.1 `players`

用途：

- 保留玩家基础标识
- 记录最近一次昵称和活跃时间

关键字段：

- `player_id`
- `nickname`
- `created_at`
- `updated_at`
- `last_seen_at`

### 9.2 `racing_rooms`

用途：

- 大厅等待房间读模型

关键字段：

- `id`
- `code`
- `host_player_id`
- `status`
- `lap_target`
- `track_id`
- `track_name`
- `track_map`
- `created_at`
- `started_at`
- `finished_at`
- `expires_at`
- `closed_reason`

### 9.3 `racing_room_players`

用途：

- 房间成员投影

关键字段：

- `room_id`
- `player_id`
- `nickname`
- `color`
- `vehicle_type`
- `ready`
- `is_host`
- `last_seen_at`

### 9.4 `racing_tracks`

用途：

- 玩家自定义赛道库

关键字段：

- `id`
- `owner_player_id`
- `name`
- `track_map`
- `track_hash`
- `cell_count`
- `bounds_json`
- `preview_points_json`
- `created_at`
- `updated_at`
- `last_used_at`
- `deleted_at`

### 9.5 `racing_matches`

用途：

- 每场比赛的 durable header

关键字段：

- `id`
- `room_id`
- `room_code`
- `phase`
- `lap_target`
- `track_id`
- `track_name`
- `track_map`
- `started_at`
- `finished_at`
- `winner_player_id`

### 9.6 `racing_match_results`

用途：

- 每场比赛的最终玩家结果

关键字段：

- `id`
- `match_id`
- `room_id`
- `player_id`
- `nickname`
- `color`
- `vehicle_type`
- `rank`
- `presence`
- `completed_laps`
- `lap_progress`
- `total_progress`
- `finished_at`
- `last_report_at`

## 10. ECS 部署口径

### 10.1 服务器软件

这台 ECS 上允许安装并配置：

- `Node.js 22`
- `pnpm`
- `PM2`
- `Nginx`
- `Certbot`
- `MySQL`
- `Git`
- `UFW`

Redis 不是本轮第一阶段必装软件；只有在后续明确决定启用缓存或多进程协同时，才进入安装范围。

### 10.2 网络边界

保留以下边界：

- `22 / 80 / 443` 对公网开放
- `2567` 不对公网开放
- `3306` 不对公网开放
- `Colyseus` 仅监听 `127.0.0.1:2567`
- `MySQL` 仅监听 `127.0.0.1:3306`

### 10.3 域名口径

- `game.pigou.top` 保持为长连接/WSS 入口
- 新前端站点用 `race2.pigou.top`

### 10.4 域名映射口径

`race2.pigou.top` 与 `game.pigou.top` 都应解析到同一台 ECS 的公网 IP。

这意味着：

- `race2.pigou.top`：新增一条 `A` 记录，指向当前这台 ECS 公网 IP
- `game.pigou.top`：继续保留现有 `A` 记录，仍指向同一台 ECS 公网 IP

区别不在 DNS，而在 Nginx 的 `server_name` 与转发目标：

- `race2.pigou.top` -> `Next.js`
- `game.pigou.top` -> `Colyseus`

### 10.5 同机部署下的内网连接边界

由于前端服务、实时服务、MySQL 都部署在同一台 ECS 上，因此服务间通信应优先走本机内网/回环地址，而不是绕公网。

约束如下：

- `Nginx -> Next.js`：走 `127.0.0.1:<next_port>`
- `Nginx -> Colyseus`：走 `127.0.0.1:2567`
- `Next.js -> MySQL`：走 `127.0.0.1:3306`
- `Colyseus -> MySQL`：走 `127.0.0.1:3306`

补充说明：

- 浏览器访问 `race2.pigou.top` 和 `wss://game.pigou.top` 仍然是公网域名，这是对外访问边界
- 但服务器内部各进程之间不需要走公网，不需要互相请求域名外网地址
- 因此前后端都在一个 IP 上时，确实应优先使用内网/回环连接

## 11. 验收标准

当下面条件全部满足时，本 spec 对应的迁移可以视为完成：

### 11.1 基础设施

- ECS 上已安装并配置所需软件
- MySQL 可本机连接
- Colyseus 服务可启动
- Next.js 前端可启动
- Nginx 反代正确

补充说明：

- 第一阶段验收不要求 Redis 存在
- 如果未来引入 Redis，应额外补 Redis 可用性、缓存命中策略和故障降级验收项

### 11.2 HTTP / WSS

- `https://race2.pigou.top` 可访问前端
- `https://race2.pigou.top/api/rooms` 可返回房间列表
- `https://race2.pigou.top/api/tracks` 可读写赛道库
- `https://race2.pigou.top/api/leaderboard` 可返回排行榜
- `https://race2.pigou.top/api/race-records` 可返回比赛记录
- `https://game.pigou.top/health` 返回 `ok: true`
- `wss://game.pigou.top` 可建立 Colyseus 连接

### 11.3 游戏主链路

- 可创建房间
- 可输入房间码加入
- 可选颜色/车型
- 可准备与取消准备
- 可发车
- 比赛中可同步排名/位置
- 可正常完赛
- 结果页可正常展示
- 自定义赛道可保存、读取、建房选择

### 11.4 旧依赖摘除

- 新分支运行时不再依赖 Supabase
- 新分支运行时不再依赖 Cloudflare Worker
- 新分支不再依赖 Vercel 运行时能力

## 12. 非目标提醒

这份 spec 只定迁移边界，不在这里展开：

- 具体代码实现
- 具体 SQL DDL 全量内容
- 具体 Nginx 配置全文
- 具体 PM2 启动脚本全文
- 逐文件改造步骤

这些留到下一步计划或实现阶段。

## 13. 当前建议

建议把这份 spec 作为 `Ali-init` 分支的迁移基线。

如果你认可这份纠偏后的方向，下一步再进入：

- 详细 implementation plan
- 然后再开始真正代码改造与 ECS 落地
