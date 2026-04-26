# Racing Online Realtime Foundation Migration

## Context

- Background:
  当前仓库 `Starter-Kit-Racing` 是一个纯静态的 `index.html + js/*.js` Three.js 赛车项目，核心运行时集中在 `js/main.js`、`js/Vehicle.js`、`js/Physics.js`、`js/Track.js`，没有服务端壳、没有房间系统、没有在线状态同步。
- Existing behavior:
  浏览器本地直接拥有车辆输入、物理推进、镜头更新和赛道状态；`editor.html` 负责生成 `map` 参数，`Track.js` 负责赛道拼装与地图编码/解码。
- Why this change is needed:
  目标不是给现有单机页外挂一个 WebSocket，而是复用 `littleNetGame` 已验证的在线游戏底座，把当前项目升级为可承载房间、权威实时状态、断线恢复、结算持久化和同域 bridge 接入的在线赛车项目。

## Goal

- Primary outcome:
  为当前赛车仓库锁定一套实现就绪的底层 realtime 迁移规范，使后续实现可以按统一的 authority boundary、transport model、durable schema 和 client/runtime adapter 落地。
- User-visible result:
  第一阶段用户能在 `racing-online` 中看到“本地 demo 模式”和“真实联机模式”两条明确路径；真实联机模式下可在移动浏览器优先的界面中进入房间、准备、开赛、重连恢复和结算，而不是继续停留在纯本地单机页。

## Scope

- In scope:
  - 将当前静态赛车项目升级为 `Next.js/Vercel` 承载的应用结构。
  - 移动浏览器作为主要游玩端：大厅、房间、比赛壳和触控输入必须优先适配手机视口。
  - 迁入 `littleNetGame` 已验证的 `Supabase + Cloudflare Durable Objects coordinator + Vercel ticket/bridge` 实时底座。
  - 为赛车项目定义在线房间、房间大厅、对局、赛道配置、圈数目标、玩家身份、颜色选择、实时排行榜和结果持久化的通用协议与最小数据模型。
  - 为现有 Three.js 赛车运行时定义“在线状态适配层”，使其能消费 coordinator 下发的房间/对局状态，而不是直接把浏览器本地状态当真相。
  - 保留缺少线上环境变量时的本地 demo 模式。
- Affected modules or surfaces:
  - 新增 `src/app` 页面与 API 路由壳。
  - 新增 `src/app/api/coordinator-ticket/route.ts`。
  - 新增 `src/app/api/coordinator-bridge/room/[code]/route.ts`。
  - 新增 `realtime-worker/` Durable Objects coordinator。
  - 新增 `supabase/migrations/` 与相关 `RLS` / RPC。
  - 新增 client session / protocol adapter。
  - 重组现有 `js/` 运行时代码为可被 React/Next.js 客户端页面挂载的赛车 runtime 模块。

## Non-goals

- Explicitly out of scope:
  - 第一阶段不要求把 `crashcat` 物理完整迁入 coordinator 并做全权威物理同步。
  - 不在本规范内承诺最终竞技级预测/回滚/反作弊方案。
  - 不处理美术替换、赛道编辑器重做、UI 风格升级、营销页或内容包装。
  - 不在本阶段扩展到匹配大厅、排行榜、好友系统、支付、登录体系复杂化。
  - 不要求 `editor.html` 立即重写成 Next.js 页面。

## Requirements

### Functional

1. 项目必须支持两种运行模式：
   - 无 `Supabase` 前端环境变量时进入本地 demo 模式。
   - 配置完整环境变量时进入真实联机模式。
2. 真实联机模式必须复用 `littleNetGame` 的 authority split：
   - `Vercel/Next.js` 负责页面壳、ticket 签发、同域 bridge。
   - `Supabase` 负责匿名身份、耐久读写、历史结果。
   - `Coordinator` 负责房间/对局真相、命令顺序、计时器、重连恢复。
3. 项目必须支持基于房间码的多人房间流转：
   - 大厅可看到等待中的房间
   - 创建房间
   - 加入房间
   - 房主设置目标圈数
   - 选择颜色
   - Ready/Start
   - 进入比赛
   - 结束结算
   - 结算后重新开始或超时解散
4. coordinator 对浏览器返回的 transport 必须支持：
   - `mode=socket`
   - `mode=bridge`
5. 当前赛车项目必须保留赛道配置能力：
   - 支持默认赛道
   - 支持 `Track.js` 已有 `map` 编码格式
   - 房主可基于现有编辑器能力设计房间地图
   - 在线房间需要能持有当前赛道配置
6. 房间内玩家必须可选择自己的颜色，且同一房间内颜色不能重复。
7. 房主必须可在开赛前设置目标圈数，且圈数必须是正整数并且最大不能超过 `10`。
8. 比赛内必须提供小地图，用于展示赛道轮廓与玩家位置。
9. 比赛界面必须提供实时排行榜，至少反映：
   - 当前圈数进度
   - 相对名次
   - 已完成/未完成状态
10. 房间必须具备超时机制：
   - 创建后 60 分钟未开始自动关闭
   - 对局结束后 60 分钟未重新开始自动关闭
11. 浏览器端必须通过统一 session client 消费：
   - `room.snapshot` / `match.snapshot`
   - `room.event` / `match.event`
   - `command.result`
12. 第一阶段必须按移动浏览器优先实现交互与布局：
   - 默认适配手机竖屏房间/大厅 UI，比赛页允许引导用户横屏但不能阻断进入。
   - 页面不得出现意外滚动、双击缩放、系统橡皮筋滚动或控件被地址栏 / 安全区遮挡。
   - 触控控制必须保留并可在 Next.js 挂载后的比赛壳中工作。
   - 房间按钮、颜色选择、ready/start 控件必须满足手指点击尺寸，不依赖 hover。

### Behavioral details

- Inputs:
  - 玩家昵称
  - 房间码
  - 房主设置的目标圈数
  - 玩家颜色选择
  - 赛车运行时输入 `steer / throttle / ready / restart / sync.request`，其中移动端主要来自触控摇杆或后续触控按钮
  - 赛道配置 `default track` 或 `Track.js` 编码后的 `map`
- Outputs:
  - `/api/coordinator-ticket` 返回 `token + url + mode`
  - bridge 模式下返回同域视图刷新结果
  - 等待中房间列表
  - room/match snapshot
  - room/match event stream
  - 实时排行榜数据
  - match report / result page 数据
- State changes:
  - 浏览器本地状态不再是最终真相
  - 房间成员、可选颜色占用、ready 状态、赛道配置、目标圈数、比赛阶段和结算结果由 coordinator / Supabase 驱动
  - 房间生命周期会受超时规则驱动进入自动关闭/解散状态
  - 赛车 runtime 通过 adapter 接收在线状态和输入命令边界
  - 比赛内排行榜随对局状态推进实时更新
- Error handling:
  - 缺少 `Supabase` 前端环境变量时，不报线上故障，自动退回本地 demo 模式
  - 缺少 `COORDINATOR_*` 时，前端必须收到可识别的 not ready 错误
  - 直连 `workers.dev` 不可靠时，前端必须能走同域 bridge
  - 事件序号缺口时，必须触发 `sync.request -> snapshot resync`
  - 颜色冲突、地图非法、房间超时关闭、目标圈数越界都必须返回明确可识别的错误或关闭原因

## Edge Cases

- 玩家在房间页或比赛页刷新后，需要能基于 snapshot 恢复房间/比赛视图。
- 两个玩家使用不同赛道入口参数进入房间时，房间必须只认房主或创建时锁定的赛道配置。
- 房主把目标圈数设置为 `0`、负数、非整数或大于 `10` 时，创建房间或开始比赛必须被拒绝。
- 多个玩家几乎同时选择同一颜色时，最终只能一个成功，其他玩家必须收到冲突反馈并保持可重选。
- coordinator 不可用但前端环境变量存在时，不能假装进入本地 demo；应明确报在线模式未就绪。
- 自定义 `map` 编码非法时，前端和 coordinator 都要回退到默认赛道或显式拒绝，不允许进入不一致状态。
- 房间在 60 分钟超时边界附近，如果玩家刚好开始比赛或点击重开，coordinator 必须保证只有一种最终状态，不允许同时“已开始”和“已关闭”。
- 小地图不能依赖与主视图不同步的本地推断状态，否则重连后会出现位置不一致。
- 实时排行榜不能只按客户端本地估算名次，否则双端可能显示不同顺序。
- `socket` 模式可用、`bridge` 模式也可用时，ticket 必须只返回一种最终 transport，不允许前端自行猜测。

## Constraints

- Technical constraints:
  - 当前仓库没有 `Next.js` / `package.json` / API 路由结构，迁移必须先引入可承载 realtime foundation 的应用壳。
  - 现有 `js/*.js` 运行时应尽量保留，不做无必要的 TypeScript 全量重写。
  - `Track.js` 的赛道编码、车辆控制和物理逻辑要通过 adapter 包进新壳，而不是直接散改现有逻辑。
  - 移动端基础 CSS 必须统一处理 `touch-action`、`overscroll-behavior`、`safe-area-inset-*` 和 `100dvh`，不能只按桌面视口验收。
- Compatibility constraints:
  - 现有默认赛道和 `map` 参数能力必须保留。
  - `editor.html` 可暂时保留为兼容入口，但在线房间要能消费其产出的 `map` 编码。
  - Vercel 前端公开变量只允许使用可公开值；任何 service role / shared secret 不能进入浏览器。
- Performance or operational constraints:
  - 高频赛车状态不写回 Postgres 作为主驱动。
  - Cloudflare coordinator 必须保持单一 authority，不让 Vercel bridge 积累业务真相。
  - 等待房间列表必须来自可恢复的耐久读模型，不能只依赖瞬时内存态。
  - 实时排行榜需要从统一比赛状态派生，不能单独维护第二套不一致排名源。
  - 第一阶段允许 coordinator 持有“比赛阶段和状态真相 + 赛车状态协议真相”，但不要求它已经完成高精度物理仿真。

## Acceptance Criteria

1. 仓库存在清晰的在线壳结构：
   - `Next.js` 页面壳
   - `ticket` API
   - `bridge` API
   - `realtime-worker`
   - `supabase` migrations
2. 缺少前端环境变量时，项目仍可进入本地 demo 模式，不被在线逻辑阻塞。
3. 配齐环境变量并部署后，两个浏览器客户端可以完成：
   - 在大厅看到等待中的房间
   - 创建房间
   - 房主设置 `1..10` 圈的目标圈数
   - 加入房间
   - 选择不冲突的颜色
   - Ready/Start
   - 进入比赛
   - 结束并看到结算结果
   - 结算后重开或在超时后被自动关闭
4. 浏览器端不直接持有房间/比赛最终真相；其 transport 选择、同步恢复和命令提交均通过统一 realtime foundation 实现。
5. 赛道配置可从默认赛道或 `map` 编码进入房间状态，并在同一房间内对所有玩家一致。
6. 比赛中存在可用的小地图，并且其赛道轮廓与玩家位置和主比赛状态一致。
7. 比赛中存在实时排行榜，并且双端对名次和圈数进度的展示一致。
8. `workers.dev` 在客户端不稳定时，系统仍能通过 `mode=bridge` 完成房间与比赛主链路。
9. 移动浏览器验收必须通过：
   - 390px 宽度下大厅、创建/加入房间、颜色选择、ready/start 不溢出、不依赖 hover。
   - 比赛壳在移动视口中占满可用高度，触控摇杆可用，页面不滚动。
   - Safari/Chrome 移动浏览器地址栏变化时，核心控件不被安全区遮挡。

## Assumptions / Open Questions

- Assumption:
  第一阶段优先迁入在线底座与房间/对局协议，不把完整 `crashcat` 权威物理作为首批强制目标。
- Assumption:
  `littleNetGame` 的通用耐久模型可复用为房间/成员/比赛/结算主表，赛车特有配置优先作为 `rooms` / `matches` 的配置字段承载，而不是立即拆出大量新表。
- Open question:
  赛车状态在第一阶段是“客户端本地推进 + coordinator 校验/广播”还是“coordinator 持有简化状态推进权威”，需要在实现前进一步收口；这会直接影响小地图与多人可见状态的来源。
- Open question:
  `editor.html` 是保留独立入口并通过 `map` 参数接入在线房间，还是后续迁成新壳中的路由页面。
- Open question:
  房间大厅的展示策略是否只显示“等待中且未超时”的房间，还是允许展示“刚结束可重开”的房间，需要在实现前锁定。
- Open question:
  实时排行榜第一阶段按“完成圈数 + 当前圈内进度 + 完成时间”排序，还是只先按“完成圈数 + 是否完赛”排序，需要在实现前锁定。
- Open question:
  比赛页最终是否强制横屏仍留到 Phase 3；Phase 1 只要求移动端可进入、可控制、布局不破。

## Verification Notes

- Suggested checks:
  - 核对 `ticket -> mode -> socket/bridge` 选择逻辑是否与 `littleNetGame` 一致。
  - 核对浏览器缺 env 时是否稳定走 demo mode。
  - 核对房间创建后的赛道配置在双端是否一致。
  - 核对刷新/断线后的 `snapshot` 恢复链路。
  - 核对移动视口下 `100dvh`、安全区、触控控制和无滚动表现。
- Suggested tests:
  - coordinator 协议与 session reducer 单测
  - `/api/coordinator-ticket` 与 bridge route 测试
  - `Supabase` env 编译与运行时测试
  - 双客户端 smoke test：hall list -> create room -> set lap target -> join -> choose color -> ready -> start -> live leaderboard -> finish -> restart or timeout close

## Suggested Delivery Phases

### Phase 1: Online Shell And Room Lifecycle

- 引入 `Next.js/Vercel` 应用壳、`Supabase` 身份和 `Cloudflare coordinator` 基础链路。
- 落房间大厅、创建/加入房间、等待中房间列表、颜色唯一选择、房主目标圈数设置（最大 `10`）、房间超时自动关闭。
- 这一阶段只要求默认赛道在线可跑，不要求自定义地图和小地图。

#### Phase 1 Implementation Task List

Phase 1 的边界先收口为：`coordinator` 持有房间、成员、ready、颜色、目标圈数、阶段流转和超时真相；赛车物理仍在浏览器本地推进。开赛后先进入默认赛道的在线比赛壳，后续 Phase 3 再把赛车状态、小地图和实时排行榜接入统一比赛状态。大厅第一阶段只展示 `waiting` 且未超时的房间，不展示已结束可重开的房间。

移动端边界同时锁定为：Phase 1 的大厅、房间和比赛壳按手机浏览器优先；比赛页不强制横屏，但要提供可用的触控控制、全高画布、无页面滚动和安全区避让。桌面键盘 / 手柄继续保留为兼容输入。

##### Task 1: 建立 Next.js 应用壳

- Files:
  - Create: `package.json`
  - Create: `next.config.mjs`
  - Create: `tsconfig.json`
  - Create: `src/app/layout.tsx`
  - Create: `src/app/page.tsx`
  - Create: `src/app/globals.css`
  - Keep: `index.html`, `editor.html`, `js/*.js` 暂不删除，作为迁移前兼容入口。
- Implementation:
  - 增加脚本：`dev`、`build`、`start`、`lint`、`test`。
  - 增加依赖：`next`、`react`、`react-dom`、`@supabase/supabase-js`。
  - 增加开发依赖：`typescript`、`eslint`、`eslint-config-next`、`vitest`、`@testing-library/react`、`@testing-library/jest-dom`、`jsdom`。
  - `src/app/page.tsx` 只负责模式分流：缺少 `NEXT_PUBLIC_SUPABASE_URL` 或 `NEXT_PUBLIC_SUPABASE_ANON_KEY` 时展示本地 demo 入口；变量齐全时展示在线大厅入口。
  - `src/app/globals.css` 统一设置移动浏览器基础：`html/body` 使用 `100dvh`、禁用页面滚动、设置 `touch-action: manipulation` 和安全区 CSS 变量。
  - 所有新建公共类型、协议和复杂函数必须写专业 JSDoc，说明字段语义、状态归属和调用边界。
- Verification:
  - Run: `npm install`
  - Run: `npm run build`
  - Expected: Next.js 能完成生产构建；缺少线上环境变量时页面不抛错。
- Done when:
  - `npm run dev` 能启动 Next.js。
  - 浏览器访问 `/` 能看到本地 demo / online hall 的明确分支。
  - 390px 移动视口下首页没有横向溢出。

##### Task 2: 固定环境变量与在线模式判定

- Files:
  - Create: `src/config/env.ts`
  - Create: `.env.example`
  - Create: `src/config/env.test.ts`
- Implementation:
  - `env.ts` 导出 `getPublicRuntimeMode()`，返回：
    - `demo`：缺少 `NEXT_PUBLIC_SUPABASE_URL` 或 `NEXT_PUBLIC_SUPABASE_ANON_KEY`
    - `online`：Supabase 前端变量齐全
  - `env.ts` 导出 `getServerCoordinatorConfig()`，读取 `COORDINATOR_URL`、`COORDINATOR_SHARED_SECRET`、`COORDINATOR_BRIDGE_ENABLED`。
  - server API 缺少 coordinator 配置时返回 machine-readable error：`COORDINATOR_NOT_READY`。
  - `.env.example` 明确区分浏览器可公开变量和服务端 secret，不能把 service role 或 shared secret 放进 `NEXT_PUBLIC_*`。
- Verification:
  - Run: `npm run test -- src/config/env.test.ts`
  - Expected:
    - 缺少 Supabase 前端变量时返回 `demo`
    - Supabase 变量齐全时返回 `online`
    - 缺少 coordinator 服务端变量时返回 `COORDINATOR_NOT_READY`
- Done when:
  - 在线 / 本地 demo 分支不再散落在页面组件里，由统一配置模块判定。

##### Task 3: 定义 Phase 1 协议与错误码

- Files:
  - Create: `src/realtime/protocol.ts`
  - Create: `src/realtime/protocol.test.ts`
- Implementation:
  - 定义 transport：`socket`、`bridge`。
  - 定义 room status：`waiting`、`racing`、`finished`、`closed`。
  - 定义 player status：`joined`、`ready`、`disconnected`。
  - 定义命令：
    - `room.create`
    - `room.join`
    - `room.leave`
    - `room.setLapTarget`
    - `room.chooseColor`
    - `room.ready`
    - `room.start`
    - `room.closeExpired`
    - `sync.request`
  - 定义事件：
    - `room.snapshot`
    - `room.event`
    - `command.result`
  - 定义错误码：
    - `ROOM_NOT_FOUND`
    - `ROOM_CLOSED`
    - `ROOM_NOT_WAITING`
    - `ROOM_EXPIRED`
    - `COLOR_TAKEN`
    - `LAP_TARGET_INVALID`
    - `ONLY_HOST_CAN_START`
    - `NOT_ALL_PLAYERS_READY`
    - `COORDINATOR_NOT_READY`
    - `AUTH_TICKET_INVALID`
  - `lapTarget` 必须是 `1..10` 的整数；颜色只允许 Phase 1 车辆资源已存在的 `yellow`、`green`、`purple`、`red`。
- Verification:
  - Run: `npm run test -- src/realtime/protocol.test.ts`
  - Expected:
    - 非整数、`0`、负数、`11` 都被判定为 `LAP_TARGET_INVALID`
    - 重复颜色命令响应 `COLOR_TAKEN`
- Done when:
  - client、API route、worker 都只引用同一份协议命名，不各自发明字符串。

##### Task 4: 建 Supabase schema 与 RLS

- Files:
  - Create: `supabase/migrations/202604260001_racing_room_lifecycle.sql`
  - Create: `supabase/README.md`
- Implementation:
  - 新增表 `racing_rooms`：
    - `id uuid primary key`
    - `code text unique not null`
    - `host_player_id text not null`
    - `status text not null`
    - `lap_target integer not null default 3`
    - `track_map text null`
    - `created_at timestamptz not null default now()`
    - `started_at timestamptz null`
    - `finished_at timestamptz null`
    - `expires_at timestamptz not null`
    - `closed_reason text null`
  - 新增表 `racing_room_players`：
    - `room_id uuid not null references racing_rooms(id)`
    - `player_id text not null`
    - `nickname text not null`
    - `color text null`
    - `ready boolean not null default false`
    - `is_host boolean not null default false`
    - `last_seen_at timestamptz not null default now()`
    - primary key: `(room_id, player_id)`
  - 新增唯一约束：同一房间内 `color` 不重复，允许 `color is null`。
  - 新增索引：`racing_rooms(status, expires_at)`、`racing_room_players(room_id)`。
  - RLS 第一阶段只允许匿名读等待中房间列表；写入主路径通过 coordinator / server-side bridge，不允许浏览器直接改房间真相。
  - `supabase/README.md` 记录本地执行 migration 的命令和表职责。
- Verification:
  - Run: `supabase db reset` 或项目约定的本地 migration 命令。
  - Expected:
    - 两张表、索引、RLS policy 创建成功。
    - 同房间重复非空颜色插入失败。
- Done when:
  - 等待中房间列表能从耐久表恢复，不依赖 coordinator 内存。

##### Task 5: 实现匿名身份 session

- Files:
  - Create: `src/session/playerSession.ts`
  - Create: `src/session/playerSession.test.ts`
- Implementation:
  - 在浏览器 `localStorage` 保存：
    - `playerId`
    - `nickname`
    - `lastRoomCode`
  - `playerId` 使用 `crypto.randomUUID()` 生成，刷新页面不变。
  - nickname 为空时使用 `Racer` 加 4 位短码，最大长度限制为 `20`。
  - 该模块只管理浏览器身份，不写房间真相。
- Verification:
  - Run: `npm run test -- src/session/playerSession.test.ts`
  - Expected:
    - 首次访问生成稳定 `playerId`
    - nickname 超长会被截断或拒绝为明确错误
- Done when:
  - 创建 / 加入 / 重连都能复用同一个 `playerId`。

##### Task 6: 实现 coordinator ticket API

- Files:
  - Create: `src/app/api/coordinator-ticket/route.ts`
  - Create: `src/app/api/coordinator-ticket/route.test.ts`
  - Modify: `src/config/env.ts`
- Implementation:
  - `POST /api/coordinator-ticket` 输入：
    - `playerId`
    - `nickname`
    - optional `roomCode`
  - 服务端校验基础字段后，用 `COORDINATOR_SHARED_SECRET` 签发短期 ticket。
  - 返回：
    - `token`
    - `url`
    - `mode`
  - `mode` 选择规则：
    - coordinator direct socket 可用时返回 `socket`
    - direct socket 不可用且 `COORDINATOR_BRIDGE_ENABLED=true` 时返回 `bridge`
    - 两者都不可用时返回 `COORDINATOR_NOT_READY`
  - ticket 不能把 shared secret、service role 或 Supabase secret 返回给浏览器。
- Verification:
  - Run: `npm run test -- src/app/api/coordinator-ticket/route.test.ts`
  - Expected:
    - 缺少 coordinator 配置返回 `COORDINATOR_NOT_READY`
    - 正常配置返回唯一 `mode`
    - 响应 body 不包含任何 secret 环境变量值
- Done when:
  - 前端不自行猜测 socket / bridge，完全服从 ticket 返回值。

##### Task 7: 实现同域 bridge API

- Files:
  - Create: `src/app/api/coordinator-bridge/room/[code]/route.ts`
  - Create: `src/app/api/coordinator-bridge/room/[code]/route.test.ts`
- Implementation:
  - `POST /api/coordinator-bridge/room/[code]` 接收 Phase 1 命令并转发到 coordinator。
  - bridge 只做鉴权、转发和响应透传，不保存业务真相。
  - coordinator 不可用时返回 `COORDINATOR_NOT_READY`。
  - ticket 无效时返回 `AUTH_TICKET_INVALID`。
- Verification:
  - Run: `npm run test -- src/app/api/coordinator-bridge/room/[code]/route.test.ts`
  - Expected:
    - 命令 payload 原样转发到 coordinator。
    - coordinator 错误码原样回传给前端。
- Done when:
  - `workers.dev` 客户端直连不可用时，主链路仍可通过同域 API 完成房间命令。

##### Task 8: 搭建 Durable Objects coordinator 工程

- Files:
  - Create: `realtime-worker/package.json`
  - Create: `realtime-worker/wrangler.toml`
  - Create: `realtime-worker/src/index.ts`
  - Create: `realtime-worker/src/RoomCoordinator.ts`
  - Create: `realtime-worker/src/protocol.ts`
  - Create: `realtime-worker/src/storage.ts`
  - Create: `realtime-worker/test/roomCoordinator.test.ts`
- Implementation:
  - `RoomCoordinator` 以房间 code 作为 Durable Object id 的业务 key。
  - 支持 `fetch` command ingress；socket ingress 可以先建立握手与消息 envelope，Phase 1 至少要能和 bridge 使用同一命令处理器。
  - `storage.ts` 封装 coordinator 到 Supabase durable read model 的写入，不让业务处理器直接散写表。
  - 所有命令处理器返回 `command.result`，成功和失败都带 `seq`。
- Verification:
  - Run: `cd realtime-worker && npm install`
  - Run: `cd realtime-worker && npm test`
  - Expected:
    - 创建房间生成唯一 room code。
    - join / ready / start / color conflict / timeout close 都有单测覆盖。
- Done when:
  - coordinator 能在本地测试中独立完成房间生命周期，不依赖 React 页面。

##### Task 9: 实现房间生命周期命令

- Files:
  - Modify: `realtime-worker/src/RoomCoordinator.ts`
  - Modify: `realtime-worker/src/storage.ts`
  - Modify: `realtime-worker/test/roomCoordinator.test.ts`
- Implementation:
  - `room.create`：
    - 创建 `waiting` 房间。
    - 设置 host、默认 `lapTarget=3`、默认赛道 `trackMap=null`。
    - `expiresAt = createdAt + 60 minutes`。
  - `room.join`：
    - 只允许加入 `waiting` 且未超时房间。
    - 同一 `playerId` 重复加入时视为重连恢复。
  - `room.setLapTarget`：
    - 只允许 host 修改。
    - 只允许 `1..10` 整数。
  - `room.chooseColor`：
    - 只允许 `yellow`、`green`、`purple`、`red`。
    - 同房间颜色唯一；冲突返回 `COLOR_TAKEN`。
  - `room.ready`：
    - 玩家必须已加入房间。
    - host 也需要 ready，避免 start 时状态含糊。
  - `room.start`：
    - 只允许 host 发起。
    - 房间必须是 `waiting` 且未超时。
    - 所有玩家都必须 ready 且已选择颜色。
    - 成功后状态改为 `racing`，并发出 `room.event`。
  - `room.closeExpired`：
    - 未开始超过 60 分钟关闭，`closedReason=not_started_timeout`。
- Verification:
  - Run: `cd realtime-worker && npm test -- roomCoordinator`
  - Expected:
    - lap target 越界、重复颜色、非 host start、未全员 ready start 都返回明确错误码。
    - 超时边界只产生一种最终状态：`racing` 或 `closed`。
- Done when:
  - Phase 1 所有房间规则都由 coordinator 单点裁决。

##### Task 10: 实现浏览器 realtime session client

- Files:
  - Create: `src/realtime/sessionClient.ts`
  - Create: `src/realtime/sessionReducer.ts`
  - Create: `src/realtime/sessionReducer.test.ts`
  - Create: `src/realtime/useRoomSession.ts`
- Implementation:
  - `sessionClient.ts` 基于 ticket 的 `mode` 选择 socket 或 bridge。
  - `sessionReducer.ts` 只消费：
    - `room.snapshot`
    - `room.event`
    - `command.result`
  - reducer 发现 seq 缺口时发出 `sync.request`，再用 snapshot 覆盖本地视图状态。
  - hook 暴露：
    - `snapshot`
    - `sendCommand(command)`
    - `connectionState`
    - `lastErrorCode`
  - 浏览器 UI 不直接改本地 room truth，只通过 `sendCommand` 等 coordinator 回执。
- Verification:
  - Run: `npm run test -- src/realtime/sessionReducer.test.ts`
  - Expected:
    - 顺序事件能推进状态。
    - seq gap 会触发 `sync.request`。
    - snapshot 能恢复刷新后的房间视图。
- Done when:
  - 房间 UI 不需要知道 transport 细节。

##### Task 11: 实现大厅、创建和加入页面

- Files:
  - Create: `src/app/hall/page.tsx`
  - Create: `src/app/room/[code]/page.tsx`
  - Create: `src/components/HallRoomList.tsx`
  - Create: `src/components/CreateRoomForm.tsx`
  - Create: `src/components/JoinRoomForm.tsx`
  - Create: `src/components/RoomLobbyPanel.tsx`
  - Create: `src/components/ColorPicker.tsx`
  - Create: `src/components/LapTargetControl.tsx`
- Implementation:
  - hall 页面显示等待中且未超时的房间。
  - create 表单提交 `room.create`，成功后跳转 `/room/[code]`。
  - join 表单提交 `room.join`，成功后跳转 `/room/[code]`。
  - room 页面展示成员、颜色、ready、host、目标圈数。
  - host 可改目标圈数；所有玩家可选颜色和 ready。
  - start 按钮只在当前玩家是 host 时可点击，失败时直接展示 machine-readable error 对应的人类可读文案。
  - UI 使用 DOM overlay，不把大厅和房间菜单塞进 Three.js canvas。
  - 移动端优先使用单列布局；按钮、颜色 swatch、ready/start 控件不小于 `44px` 可点击尺寸。
  - 不依赖 hover 展示关键动作或错误提示。
- Verification:
  - Run: `npm run test`
  - Run: `npm run build`
  - Manual:
    - 两个浏览器窗口打开 `/hall`。
    - A 创建房间，B 通过房间码加入。
    - A/B 选择不同颜色，ready，A start。
    - 两人都进入比赛壳。
    - 390px 移动视口下大厅和房间页不横向溢出，主要按钮可触控。
- Done when:
  - Phase 1 的人工主链路不需要手动调用 API 就能走通。

##### Task 12: 接入默认赛道比赛壳

- Files:
  - Create: `src/app/race/[code]/page.tsx`
  - Create: `src/game/RacingRuntimeHost.tsx`
  - Create: `src/game/mountLegacyRacingRuntime.ts`
  - Modify: `js/main.js` 或后续迁移副本，导出可挂载的 `mountRacingRuntime(container, options)`。
- Implementation:
  - 第一阶段只加载默认赛道，不读取 room custom map。
  - `RacingRuntimeHost` 负责把 React 页面中的容器传给 Three.js runtime。
  - runtime 仍本地处理 `Controls`、`Vehicle`、`Physics`、`Camera`、`Particles`、`Audio`。
  - runtime 挂载容器必须占满 `100dvh`，canvas 设置 `touch-action: none`，避免移动端页面滚动抢占驾驶输入。
  - 现有 `Controls.js` 触控摇杆需要继续可用；如果摇杆挂到 `document.body`，卸载 runtime 时必须清理对应 DOM 和事件监听，避免页面切换后残留。
  - 车辆颜色来自房间成员颜色；当前玩家默认跟随自己的车。多人远端车辆可先显示静态占位或列表状态，不在 Phase 1 承诺物理同步。
  - 页面刷新后先通过 `room.snapshot` 确认房间仍在 `racing`，再挂载 runtime。
- Verification:
  - Run: `npm run build`
  - Manual:
    - host start 后跳转 `/race/[code]`。
    - 默认赛道可以渲染，当前玩家车辆可控制。
    - 刷新 `/race/[code]` 后能恢复比赛壳，不丢房间身份。
    - 移动视口下比赛壳不滚动，触控摇杆可以控制车辆。
- Done when:
  - Phase 1 已证明 Next.js 壳可以承载现有 Three.js 赛车 runtime。

##### Task 13: 补齐超时关闭与房间列表恢复

- Files:
  - Modify: `realtime-worker/src/RoomCoordinator.ts`
  - Modify: `realtime-worker/src/storage.ts`
  - Modify: `src/components/HallRoomList.tsx`
  - Modify: `realtime-worker/test/roomCoordinator.test.ts`
- Implementation:
  - coordinator 在每个房间命令进入时先检查 `expiresAt`。
  - waiting 房间超过 60 分钟未开赛时关闭。
  - hall list 只读 `racing_rooms.status='waiting' and expires_at > now()` 的耐久数据。
  - close 事件写回 Supabase，刷新大厅后不可见。
- Verification:
  - Run: `cd realtime-worker && npm test -- roomCoordinator`
  - Manual:
    - 构造已过期 waiting room。
    - 访问大厅不展示该房间。
    - 对过期 room 发 join/start 返回 `ROOM_EXPIRED` 或 `ROOM_CLOSED`。
- Done when:
  - 房间列表和 coordinator 状态在刷新后仍一致。

##### Task 14: Phase 1 集成验收与文档同步

- Files:
  - Create: `docs/runbooks/phase-1-online-room-lifecycle.md`
  - Modify: `README.md`
  - Modify: `.env.example`
- Implementation:
  - runbook 记录：
    - 本地 demo 模式启动命令。
    - online 模式所需 Supabase / coordinator env。
    - migration 执行命令。
    - worker 本地测试命令。
    - 双浏览器 smoke test 步骤。
    - 移动浏览器 smoke test 步骤：390x844 视口大厅/房间/比赛壳、触控摇杆、无页面滚动、安全区。
  - README 增加新旧入口说明：Next.js 是在线壳主入口，根目录静态 `index.html` 暂为兼容入口。
  - 记录 Phase 1 已知限制：默认赛道、无小地图、无实时排行榜、无完整权威物理。
- Verification:
  - Run: `npm run lint`
  - Run: `npm run test`
  - Run: `npm run build`
  - Run: `cd realtime-worker && npm test`
  - Manual smoke:
    - 无 Supabase 前端 env：`/` 进入本地 demo 分支。
    - 配齐 env：两个浏览器完成 hall -> create -> join -> choose color -> ready -> start -> race shell。
    - 移动视口完成 hall -> room -> race shell，控件不溢出且触控输入可用。
- Done when:
  - 后续实现者可以只按 runbook 完成 Phase 1 验收，不需要回头猜环境和命令。

### Phase 2: Custom Room Map

- 复用 `editor.html + Track.js encode/decode` 能力，把房主设计地图接到房间配置。
- 房间创建、加入、重连、开赛都以统一赛道快照为准。
- 这一阶段要补地图合法性校验和房间级赛道锁定规则。

### Phase 3: Race Session Presentation

- 把在线房间/对局状态真正接到赛车 runtime。
- 增加比赛内小地图和实时排行榜，并确保它们与在线状态一致。
- 完成结算后重开、结算后等待状态和 60 分钟未重开自动解散。

### Phase 4: Authority Deepening And Hardening

- 根据前面阶段结论，决定是否把赛车状态推进进一步收口到 coordinator。
- 强化断线恢复、bridge 容错、多人同步一致性和 smoke/verification 链路。
- 这一阶段再评估是否继续推进更强的权威物理或预测/校正方案。
