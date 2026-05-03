# Racing Multiplayer Ghost Cars And Custom Tracks

## Context

- Background:
  当前主链路已经覆盖大厅、建房、加入房间、房间准备、发车、比赛、结算和重开。单人在线模式可完整跑通，多人模式也已经有房间同步、发车同步、比赛进度同步、结算同步和重新发车能力。
- Existing code baseline:
  - `MatchPlayerState` 已经包含 `position / heading / speed / checkpoint / completedLaps / lapProgress / totalProgress`，比赛页通过 `match.progress` 把本地赛车 telemetry 上报到 coordinator。
  - `RaceHud` 已经使用 `match.players` 渲染实时排行榜和小地图玩家点位。
  - `RacingRuntimeHost` 和 `js/main.js` 当前只挂载本地赛车，运行时对 React 只暴露 `getSnapshot()`，没有远端车辆渲染入口。
  - `Track.js` 已有 `encodeCells / decodeCells / computeSpawnPosition / computeTrackBounds`，`editor.html` 已有画地图、自动拼路、localStorage 保存和分享 `map` 链接的能力。
  - Supabase 现有 `racing_rooms.track_map` 和 `racing_matches.track_map`，可以把某一局的赛道快照持久化，但还没有“玩家自己的赛道库”表和建房选图 UI。
- Why this new stage exists:
  项目已经从“能玩”进入“让多人竞速更像真正联机游戏”的阶段。下一阶段要把多人可见性、自定义赛道、地图合法性和房主选图串成一条稳定闭环，而不是只继续修零散 bug。

## Goal

- Primary outcome:
  建立第二阶段联机赛车能力：比赛中能看到其他玩家的影子车；玩家能创建、保存、管理并在房间中选择自定义赛道；被选中的赛道会同步给所有房间成员并用于同一场比赛。
- User-visible result:
  房主可以先画一张合法闭环赛道并保存到自己的赛道库，建房时选择默认赛道或自己的赛道。进入比赛后，所有玩家在同一张赛道上比赛，并能在主 3D 赛道中看到其他玩家的半透明影子车。

## Scope

- In scope:
  - 在 3D 比赛画面中渲染远端玩家影子车。
  - 影子车显示对方玩家昵称。
  - 影子车不参与本地 crashcat 碰撞，不影响本地物理、碰撞、圈数统计和完赛判断。
  - 影子车位置来自 coordinator 批准后的 `match.players` telemetry。
  - 基于现有 `editor.html` / `Track.js` 能力建设 Next.js 内的自定义赛道编辑和保存链路。
  - 为赛道编码补齐共享校验规则，确保只有有起点且闭环的地图可保存、可建房、可开赛。
  - 在 Supabase 中保存玩家赛道库。
  - 房主建房时可选择默认赛道或自己保存的赛道。
  - 房间、比赛、结果页保持使用房间创建时的赛道快照，避免赛道后续编辑影响已创建房间。
  - 保持 `socket` 为比赛实时主通道，`bridge` 继续作为降级兜底。
- Affected modules or surfaces:
  - `js/main.js`
  - `js/Track.js`
  - `src/game/RacingRuntimeHost.tsx`
  - `src/components/RaceClient.tsx`
  - `src/components/CreateRoomForm.tsx`
  - `src/components/HallClient.tsx`
  - `src/realtime/protocol.ts`
  - `realtime-worker/src/protocol.ts`
  - `realtime-worker/src/RoomCoordinator.ts`
  - `supabase/migrations/`
  - new track library API routes and UI pages/components

## Non-goals

- Explicitly out of scope:
  - 不做权威物理、预测、回滚、反作弊或服务器端赛车碰撞。
  - 不让远端影子车与本地玩家、墙体、装饰物发生物理碰撞。
  - 不做多人同屏碰撞竞技规则。
  - 不做公开赛道市场、点赞、收藏、搜索、排行榜。
  - 不做自定义地图分享给其他玩家复制到自己赛道库的能力。
  - 不要求真实账号体系；本阶段仍沿用现有本地 `playerId` 作为轻身份。
  - 不删除 `editor.html` 兼容入口；在线保存主链路迁入 Next.js 路由后，`editor.html` 仍可作为本地试玩/旧分享入口保留。
  - 不扩大到新车型、道具、AI 车、观战模式或回放系统。

## Product Requirements

### Shadow Cars

1. 比赛中每个玩家必须能看到其他参赛玩家的赛车影子。
2. 当前玩家自己的赛车仍由本地 runtime 渲染，不能重复渲染成影子车。
3. 影子车必须使用对方选择的颜色模型。
4. 影子车视觉上要和本地实体车有明显区分：
   - 半透明
   - 可降低饱和度或加 ghost material
   - 必须显示对方昵称标签，但不能遮挡驾驶视线
5. 影子车只展示位置、朝向、速度感，不参与碰撞。
6. 影子车必须平滑移动：
   - `socket` 模式下基于约 100ms telemetry 做插值。
   - `bridge` 降级下不能提高到高频 HTTP tick，应使用较慢 telemetry + 插值/外推，并允许明显更低精度。
7. 玩家断线、离开、完赛或长时间无 telemetry 时，影子车应进入可识别状态：
   - 短时间丢包：继续插值或缓慢外推。
   - 超过 stale 阈值：淡出或标记为离线。
   - 玩家完赛：可停留在最后位置或淡出，具体以不干扰继续比赛为准。

### Custom Track Library

1. 玩家必须能从已有画地图能力进入自定义赛道创建流程。
2. 玩家必须能保存地图，并为地图设置名称。
3. 玩家必须能看到自己保存的地图列表。
4. 玩家必须能编辑或覆盖自己保存的地图。
5. 玩家必须能删除自己的地图；删除不影响已经创建的房间和历史比赛。
6. 默认赛道必须继续可选，且不要求保存到玩家地图库。
7. 建房时房主必须能选择：
   - 默认赛道
   - 自己保存的某一张自定义赛道
8. 房间页和比赛页必须显示当前房间使用的赛道名称或“默认赛道”。
9. 第一阶段不支持把自己的自定义地图分享给其他玩家并复制到对方赛道库。

### Track Validation

1. 保存自定义赛道前必须校验地图。
2. 建房使用自定义赛道前必须再次校验地图。
3. coordinator 开赛前必须只接受已校验的房间 `trackMap`。
4. 不能只依赖前端校验；服务端必须能拒绝非法地图。
5. 非闭环地图不能保存。
6. 没有起点/终点 tile 的地图不能保存。
7. 起点位置必须可计算出合法 spawn position 和朝向。
8. 非法地图必须给出明确错误，不允许静默回退默认赛道后继续保存或开赛。

### Room Track Selection

1. 房主创建房间时，选择的赛道必须写入房间状态。
2. 房间状态必须包含比赛用赛道快照，而不是只保存 `trackId`。
3. 房间创建后，房主编辑原赛道不影响已创建房间。
4. `room.start` 创建 match 时，`match.trackMap` 必须继承房间赛道快照。
5. 所有玩家进入 `/race/[code]` 后必须加载相同 `match.trackMap`。
6. 若某个玩家本地无法 decode 房间赛道，必须显示明确错误并阻止进入空白赛道。

## Technical Requirements

### Shadow Car Runtime Contract

1. `RacingRuntimeHost` 需要向 legacy runtime 传入远端玩家列表，或暴露 runtime handle 方法用于增量更新：
   - `setRemoteVehicles(vehicles)`
   - or `updateRemoteVehicle(playerId, snapshot)`
2. runtime 内部负责创建、更新、隐藏和销毁影子车模型。
3. 影子车必须使用独立 Three.js object group，不加入 crashcat world。
4. 影子车 update 只读目标 position/heading/speed，不创建 rigid body。
5. React 层只把 coordinator state 转成 plain data，不直接操作 Three.js object。
6. 每个影子车必须按 `playerId` 稳定复用模型实例，不能每帧重建。
7. 模型资源复用现有 `vehicle-truck-{color}.glb`。
8. 昵称标签跟随影子车，但应使用独立 label layer 或 lightweight sprite/css label，不能进入物理世界。
9. 插值状态留在 runtime 内部，避免 React 高频 setState 驱动渲染。

### Track Codec And Validator

1. 需要把地图编码/解码/校验收口到可复用纯逻辑：
   - 浏览器编辑器可用
   - Next.js API 可用
   - coordinator/worker 可用
   - 单测可用
2. codec/validator 不能依赖 DOM、Canvas 或 Three.js scene 对象；base64url 编解码也不能只依赖浏览器全局能力。
3. 现有 `Track.js` API 应保持兼容，避免一次性大改 legacy runtime。
4. 校验输入为 encoded `trackMap` 或 cell array，输出包含：
   - `ok`
   - normalized `trackMap`
   - `cellCount`
   - `bounds`
   - `finishCell`
   - `spawn`
   - `errors[]`
5. 地图合法性规则：
   - encoded map 必须可 decode。
   - cell 数必须在合理范围内，第一阶段使用 `8..192`。
   - 坐标必须在编码支持范围内，建议第一阶段收紧为 `-64..63`。
   - 不允许重复 cell。
   - 只允许现有 piece type：`track-straight`、`track-corner`、`track-bump`、`track-finish`。
   - 只允许现有 Godot orientation：`0`、`10`、`16`、`22`。
   - 必须且只能有一个 `track-finish`。
   - 所有 road cell 必须连成一个 component。
   - 每个 cell 的连接度必须等于 `2`，不允许断头路、分叉和孤立 tile。
   - 所有连接必须双向成立。
   - 从 finish tile 沿连接行走必须能回到 finish tile，且覆盖全部 cell。
   - 计算出的 spawn position 必须有限且落在 finish tile 附近。
6. 校验失败错误码建议：
   - `TRACK_MAP_INVALID`
   - `TRACK_MAP_TOO_SMALL`
   - `TRACK_MAP_TOO_LARGE`
   - `TRACK_MAP_COORDS_OUT_OF_RANGE`
   - `TRACK_MAP_DUPLICATE_CELL`
   - `TRACK_MAP_FINISH_MISSING`
   - `TRACK_MAP_FINISH_DUPLICATE`
   - `TRACK_MAP_NOT_CONNECTED`
   - `TRACK_MAP_NOT_CLOSED_LOOP`
   - `TRACK_MAP_UNSUPPORTED_TILE`

### Supabase Track Data Model

1. 新增玩家赛道库表，建议表名 `racing_tracks`。
2. 建议字段：
   - `id uuid primary key`
   - `owner_player_id text not null`
   - `name text not null`
   - `track_map text not null`
   - `track_hash text not null`
   - `cell_count integer not null`
   - `bounds jsonb not null`
   - `preview_points jsonb null`
   - `created_at timestamptz not null`
   - `updated_at timestamptz not null`
   - `last_used_at timestamptz null`
   - `deleted_at timestamptz null`
3. `racing_rooms` 和 `racing_matches` 建议增加：
   - `track_id uuid null`
   - `track_name text null`
4. `track_map` 仍然保留在 room/match 表中，作为比赛快照和最终真相。
5. 第一阶段的 owner 是现有本地 `playerId`，不是安全账号身份；后续如果接真实登录，再迁移 owner 语义。
6. RLS/读写策略先按当前项目轻身份约束设计：
   - 大厅可读 waiting room 所需的赛道名称。
   - track library 的写入通过 server API 使用 service role 进行。
   - 浏览器不直接持有 service role。

### Protocol Changes

1. `RacingErrorCode` 需要新增 track validation 相关错误码。
2. `room.create` payload 建议扩展：
   - `trackId?: string | null`
   - `trackMap?: string | null`
   - `trackName?: string | null`
3. 当前建房路径是 `HallClient -> /api/coordinator-ticket -> /api/coordinator-bridge/room/new -> worker /rooms`；`trackId` 解析、owner 检查和 `trackMap / trackName` 注入应放在 server bridge/create 边界完成。
4. 浏览器不应直接把未校验 raw map 当作可信房间配置提交给 coordinator。
5. coordinator 仍必须对最终 `trackMap` 做校验或校验摘要检查。
6. `RoomState` / `MatchState` 建议扩展：
   - `trackId: string | null`
   - `trackName: string | null`
   - `trackMap: string | null`
7. `match.progress` 频率不因影子车上线而盲目提高；先依赖现有 socket 约 100ms 和 bridge 约 600ms 策略。

## Edge Cases

- 房主选择自定义赛道后立刻删除原地图：
  已创建房间继续使用房间内 `trackMap` 快照，不受影响。
- 房主选择赛道后又编辑原地图：
  已创建房间不变，新建房间使用新版地图。
- 玩家通过旧分享链接进入非法 `map`：
  可在本地试玩入口提示非法；在线保存和在线建房必须拒绝。
- 房主建房时所选 `trackId` 不存在或不属于自己：
  创建房间失败并返回明确错误。
- 房主保存空地图、断头路、8 字分叉、多个 finish、无 finish：
  保存失败，编辑器保留当前草稿。
- 自定义赛道太大：
  保存失败，避免超大 `trackMap` 影响房间 state、DO storage 和 telemetry 计算。
- 远端玩家 telemetry 暂停：
  影子车不能瞬移到原点；应保持最后位置并进入 stale/fade 状态。
- 远端玩家倒车或 telemetry regression 被 coordinator 拒绝：
  影子车应继续显示 coordinator 上一次批准的位置。
- 本地玩家刷新比赛页：
  runtime 重新加载同一 `match.trackMap`，影子车从最新 match snapshot 恢复。
- bridge 降级期间：
  影子车可以较低频更新，但不能引入高频 HTTP 请求放大成本。

## Acceptance Criteria

1. 两个浏览器玩家进入同一房间并开赛后，玩家 A 能在 3D 赛道中看到玩家 B 的影子车，玩家 B 也能看到玩家 A 的影子车。
2. 影子车颜色与房间选择一致，且不会与本地车发生碰撞。
3. 影子车在主 3D 画面显示对方昵称，且昵称不遮挡核心驾驶视线。
4. 影子车断线/离开/stale 状态不会导致主 runtime 报错或黑屏。
5. 默认赛道主链路继续可用。
6. 玩家能创建并保存一张合法自定义赛道。
7. 玩家能在自己的赛道列表中看到保存的地图。
8. 非闭环地图、无起点地图、多个起点地图不能保存。
9. 房主建房时能选择默认赛道或自己保存的地图。
10. 使用自定义地图建房后，所有玩家房间页和比赛页看到的是同一张赛道。
11. 自定义地图比赛中圈数统计、排行榜、小地图和结算仍然成立。
12. 已创建房间不受原地图后续编辑或删除影响。
13. 至少以下验证通过：
   - `npm test`
   - `npm run lint`
   - `npm run build`
   - `cd realtime-worker && npm test`
   - `cd realtime-worker && npm run typecheck`
   - 两浏览器真实联机 smoke：默认赛道影子车
   - 两浏览器真实联机 smoke：自定义赛道建房、开赛、完赛、结算

## Suggested Delivery Phases

### Phase 1: Shadow Cars In Existing Multiplayer Race

- Goal:
  先利用现有 `match.players` telemetry，把远端车辆可视化做出来，不碰自定义赛道。
- Tasks:
  - 给 runtime 增加 remote vehicle 管理器。
  - 在 `RacingRuntimeHost` 增加远端车辆数据入口。
  - 在 `RaceClient` 从 `match.players` 过滤当前玩家，生成 remote vehicle snapshots。
  - 实现影子车插值、昵称标签、stale 处理和销毁。
  - 补单测或轻量组件测试覆盖“自己不渲染成影子车”“断线玩家状态不崩”。
- Exit:
  默认赛道两人联机时，主赛道上能看到带昵称的对方影子车。

### Phase 2: Track Validation Foundation

- Goal:
  先把“什么地图是合法赛道”锁成可测试的共享规则。
- Tasks:
  - 抽出或新增 track codec / validator 纯逻辑。
  - 保持 `Track.js` legacy API 兼容。
  - 为闭环、finish、连接度、重复 cell、越界、大小限制补单测。
  - 在 editor 保存动作前调用校验。
  - 在 server/coordinator 接收 `trackMap` 前调用校验。
- Exit:
  合法闭环地图通过；断头路、分叉、无 finish、多 finish 都会被拒绝。

### Phase 3: Supabase Track Library And Editor Save

- Goal:
  玩家可以保存、查看、编辑、删除自己的地图。
- Tasks:
  - 新增 `racing_tracks` migration。
  - 新增 track library server API。
  - 新增 Next.js `/tracks` 或 `/track-editor` 路由作为在线赛道编辑主入口。
  - 迁入或封装现有 `editor.html` 的绘制、自动拼路、预览和 encode 逻辑。
  - 在 Next.js 编辑器中加入地图名称和保存入口。
  - 新增“我的赛道”列表 UI。
  - 保存时写入 normalized track map、hash、cell count、bounds 和 preview points。
  - 删除采用 soft delete，保护历史房间和比赛。
  - 保留 `editor.html` 作为兼容入口，但不把它作为在线保存主入口。
- Exit:
  玩家能保存合法地图，并能在列表中看到、重新打开和删除。

### Phase 4: Room Creation Track Picker

- Goal:
  房主建房时可以选择地图，并把地图快照同步给所有人。
- Tasks:
  - 扩展 `CreateRoomForm`，加入默认赛道/我的赛道选择。
  - `HallClient` 创建房间时传递 `trackId`。
  - bridge/create server 边界读取 track library，校验 owner 后注入 `trackMap / trackName`。
  - 扩展 room/match protocol 和 worker state。
  - Supabase `racing_rooms / racing_matches` 保存 `track_id / track_name / track_map`。
  - 房间页、比赛页、结果页展示赛道名。
- Exit:
  房主选择自定义赛道建房后，加入者进入比赛加载同一 `match.trackMap`。

### Phase 5: Multiplayer Custom Track Stabilization

- Goal:
  把影子车、自定义地图、圈数统计、结算和重开放到同一条真实联机链路里压测。
- Tasks:
  - 两浏览器跑默认赛道和自定义赛道 smoke。
  - 验证自定义赛道小地图、排行榜和完赛判定。
  - 验证重开后仍使用同一房间赛道快照。
  - 验证 bridge fallback 下影子车降级表现和 DO 请求量。
  - 补 runbook：如何创建合法地图、如何验证两端同图、如何排查影子车不同步。
- Exit:
  自定义地图多人房间能稳定完成建房、同步、开赛、可视化对手、完赛、结算和重开。

## Risks And Tradeoffs

- Shadow car smoothness depends on telemetry cadence:
  `socket` 下体验会明显更好；`bridge` 不能为了顺滑把 telemetry 提到高频 HTTP，否则会重新放大 Durable Objects 请求成本。
- Track validation must exist on server side:
  只在 editor 里校验会被旧链接、手写请求或脏数据绕过，最终会伤到比赛页和圈数统计。
- Track ownership is weak before real auth:
  本阶段用本地 `playerId` 绑定“我的赛道”，适合当前匿名轻量游戏，但不是严格安全边界。
- Editor should move into the app shell for online save:
  第一版在线保存走 Next.js 路由更合适，因为它要复用玩家 session、server API、Supabase 写入和移动端布局；实现上可以复用现有 `editor.html` 的核心绘制逻辑，避免重写所有编辑算法。
- Room state should store track snapshot:
  这会让 room/match 行稍大，但能换来历史比赛可恢复和房间不受地图后续编辑影响。

## Resolved Product Decisions

- 第一阶段不做自定义地图分享/复制到其他玩家赛道库。
- 地图上限第一阶段使用 `192` 个 cell。
- 影子车必须在主 3D 画面显示昵称标签。
- 编辑器第一版采用 Next.js 路由作为在线保存主入口，同时复用现有 `editor.html` 的编辑逻辑并保留旧入口兼容。

## Exit Condition

当下面两条都稳定成立，这个新阶段才算完成：

1. 多人比赛默认赛道中，玩家能在主 3D 画面看到对方不参与碰撞的影子车。
2. 房主能保存一张合法闭环自定义地图，建房选择它，并让所有玩家在同一张地图上完成一局可结算的多人比赛。
