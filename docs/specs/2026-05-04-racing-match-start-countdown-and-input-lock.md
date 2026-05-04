# Racing Match Start Countdown And Input Lock

## Context

- Background:
  当前多人联机主链路已经有大厅、房间、准备、`room.start`、比赛页、实时进度上报和结算。但现在的发车语义仍然是“房主点击发车后，符合资格的玩家立刻进入正式比赛”。
- Existing code baseline:
  - `realtime-worker/src/RoomCoordinator.ts` 当前在 `room.start` 时直接把 `room.status` 切到 `racing`，并立即创建 `phase = 'live'` 的 `activeMatch`。
  - `src/components/RoomClient.tsx` 当前只要看到 `room.status === 'racing'` 就会立刻跳转 `/race/[code]`。
  - `src/components/RaceClient.tsx` 当前在 `match.phase === 'live'` 时开始按固定频率发送 `match.progress`。
  - 当前玩家本地一旦上报完赛，worker 会用 `finishedAt` 和 `MATCH_FINISH_DUPLICATE` 阻止继续记成绩，但 runtime 侧还没有“个人完赛立即锁车等待结算”的明确边界。
  - `js/main.js` / `js/Controls.js` 当前 runtime 一挂载就接受键盘、手柄和触控输入，没有“发车前锁车”能力。
  - `src/components/RaceHud.tsx` 和 `src/game/raceTiming.ts` 当前把 `match.startedAt` 当作正式比赛计时起点。
- Why this change is needed:
  真实玩家的进入比赛页速度受网络和设备影响很大。现在网络快的玩家会更早拿到可操作赛车，网络慢的玩家进来时别人可能已经跑出明显距离，导致发车公平性很差。

## Goal

- Primary outcome:
  把当前“点发车就立刻开始正式比赛”的行为改成“先进入统一的 15 秒发车倒计时，倒计时结束后才开始正式计时和允许操作”。
- User-visible result:
  房主点击发车后，所有参赛车手都先看到居中的大倒计时；倒计时阶段所有人的车都固定在出发点且无法操作；倒计时归零后才统一起跑并开始正式比赛计时。

## Scope

- In scope:
  - `room.start` 之后的比赛启动语义重定义。
  - 比赛页中央倒计时 UI。
  - 倒计时阶段的本地输入锁定和禁止进度上报。
  - 个人完赛后的本地锁车与等待结算提示。
  - 倒计时阶段的重连 / 刷新恢复。
  - `socket` / `bridge` 两条 transport 下的统一开赛边界。
  - 正式比赛计时起点与结果计时口径调整。
- Affected modules or surfaces:
  - `realtime-worker/src/protocol.ts`
  - `realtime-worker/src/RoomCoordinator.ts`
  - `realtime-worker/src/index.ts`
  - `src/realtime/protocol.ts`
  - `src/realtime/useMatchSession.ts`
  - `src/components/RoomClient.tsx`
  - `src/components/RaceClient.tsx`
  - `src/components/RaceHud.tsx`
  - `src/game/raceTiming.ts`
  - `src/game/RacingRuntimeHost.tsx`
  - `js/main.js`
  - `js/Controls.js`
- Explicitly kept unchanged:
  - 只有已选车且已准备的玩家才能进入比赛 roster，这一条保持当前规则不变。
  - 比赛结束、结算、重开、房间超时的整体生命周期边界不在本次需求中改写。
  - 默认赛道 / 自定义赛道的选择和校验能力不在本次需求中改写。

## Non-goals

- Explicitly out of scope:
  - 不做“等所有客户端都确认加载完成后才开始”的 loaded-barrier 机制。
  - 不做无限等待慢网玩家的动态发车策略；本次只锁定固定 `15` 秒倒计时。
  - 不允许发车后再往比赛 roster 中补新玩家。
  - 不改成服务器权威物理，也不做 rollback / prediction / anti-cheat。
  - 不改远端影子车、排行榜排序规则或结果页结构。

## Product Requirements

### Start Countdown

1. 房主点击发车后，系统必须立即进入“发车倒计时”状态，而不是直接进入正式比赛状态。
2. 倒计时总时长固定为 `15` 秒。
3. 倒计时必须显示在比赛页屏幕中央，所有玩家进入比赛页后都能清楚看到。
4. 中央倒计时必须是主视觉，不允许只放在角落 HUD 文案里。
5. 倒计时结束前，正式比赛计时必须保持未开始状态：
   - HUD 计时不得提前累加。
   - `completedLaps / lapProgress / totalProgress` 不得因为倒计时而推进。
6. 倒计时结束后，比赛才进入正式 `live` 状态，并从统一的官方起跑时间开始计时。
7. 单人在线房间也沿用同一套 `15` 秒倒计时规则，避免出现两套发车语义。

### Countdown Visual Direction

1. 倒计时视觉必须做成明显偏“赛车发车仪式感”的表现，不能只是普通平面数字文本闪烁。
2. 总倒计时仍然是 `15` 秒，但强视觉主秀锁定在最后 `5 -> 4 -> 3 -> 2 -> 1 -> GO!`。
3. `15 -> 6` 阶段应作为“预备倒计时”：
   - 可以继续放在屏幕中央
   - 但视觉权重必须明显低于最后 `5 -> GO!`
   - 不能从 `15` 秒开始就用最大号重特效数字持续遮挡赛道
4. 最后 `5 -> 1` 每个数字都必须是独立节拍，不允许只是一个普通文本每秒改值。
5. `GO!` 必须作为单独状态出现，且视觉冲击力要高于 `5 -> 1` 的单个数字。
6. 推荐视觉语言：
   - 大号透视字
   - 假 3D 挤出或厚度感
   - 金属 / 霓虹 / 赛博发车灯风格的高亮边缘
   - 缩放冲击、轻微旋入或前冲动效
   - 短暂发光、拖尾或径向能量脉冲
7. “3D 效果”这里定义为明确可见的空间层次感，而不是单纯加粗或阴影：
   - 至少要有透视、厚度、分层阴影或景深式层叠中的两项
   - 最终实现可以用 CSS 3D transform、分层文字、shader 风格材质或 Canvas/Three 叠层实现
   - 本 spec 不强制具体技术方案
8. 倒计时主视觉必须与赛道世界观协调，倾向“发车灯牌 / 竞速 HUD / 赛道起跑信号”气质，不要做成卡通综艺字幕感。

### Input Lock During Countdown

1. 倒计时阶段所有本地输入都必须被忽略：
   - 键盘
   - 触控摇杆
   - 手柄
2. 倒计时阶段玩家不能通过任何输入让本地车提前移动、转向、加速或倒车。
3. 倒计时阶段车辆必须停留在出发点等待。
4. 倒计时结束前，即使玩家已经提前按住方向或油门，也不能出现“偷跑”位移。
5. 倒计时结束后的第一帧起，输入才重新生效。

### Late Entry And Recovery During Countdown

1. 发车后但倒计时尚未结束时，已锁入比赛 roster 的玩家如果才刚进入 `/race/[code]`，仍然必须先看到剩余倒计时并在出发点等待。
2. 倒计时阶段刷新页面或断线重连后，客户端必须恢复到同一个权威倒计时，而不是本地重新从 `15` 开始。
3. 倒计时阶段 `match.join` 仍然允许已注册车手加入比赛会话，但不允许他们绕过倒计时直接获得控制权。
4. 如果玩家直到倒计时结束后才真正进到比赛页，本次需求不保证其“绝对同步起跑”；它只能按当时的正式比赛状态进入。这属于固定 15 秒缓冲之外的情形。

### Post-finish Input Lock

1. 任意玩家一旦完成自己的比赛并拿到权威完赛状态后，该玩家的本地赛车必须立刻失去操控能力。
2. “拿到权威完赛状态”在当前协议下以该玩家的 `finishedAt` 已存在为准，而不是只看本地是否感觉自己已经冲线。
3. 已完赛玩家在整局仍未结束时必须留在比赛页等待其他玩家：
   - 不能继续操控车辆
   - 不能继续跑圈或回头乱开
   - 不能提前跳结算页
4. 已完赛玩家必须等到以下两种情况之一才离开比赛页：
   - 其他玩家也完成，整局正式结束
   - finish deadline 到期，coordinator 把整局收束为 `finished`
5. 已完赛车辆应停留在终点附近或最后合法完赛位置，不能在失去控制后继续作为“可驾驶状态”满场滑行。
6. 已完赛玩家在等待期间仍应能看到：
   - 其他玩家排名变化
   - 比赛是否已结束
   - 自己已经完赛、正在等待结算的明确信息

## Technical Requirements

### Match State Model

1. `MatchPhase` 需要从当前的：
   - `live`
   - `finished`
   - `aborted`
   扩展为：
   - `countdown`
   - `live`
   - `finished`
   - `aborted`
2. `room.status` 保持现有语义，不新增 `countdown` room status：
   - `room.start` 一旦成功，`room.status` 仍然立刻进入 `racing`，用于让符合资格的玩家跳转到比赛页。
   - 真正的“能不能开车”由 `match.phase` 决定，而不是由 `room.status` 决定。
3. `room.startedAt` 和 `match.startedAt` 的语义需要明确拆开：
   - `room.startedAt` = 房主点击发车、倒计时开始的时间。
   - `match.startedAt` = 正式比赛开始的官方时间，也就是倒计时结束时刻。
4. `room.startedAt` 允许比 `match.startedAt` 早 `15` 秒；这是本次改动后的有意设计，不是数据错误。
5. 引入共享常量 `MATCH_START_COUNTDOWN_MS = 15000`，由 worker、client、测试共用，避免多处魔法数字漂移。
6. `room.start` 创建 `activeMatch` 时，必须满足：
   - `room.status = 'racing'`
   - `match.phase = 'countdown'`
   - `room.startedAt = now`
   - `match.startedAt = now + 15000ms`

### Authoritative Countdown Transition

1. 倒计时结束到正式开赛的切换必须由 coordinator 认定，不能只靠前端本地定时器私自把比赛当作 `live`。
2. coordinator 必须在到达 `match.startedAt` 时把 `match.phase` 从 `countdown` 切为 `live`。
3. 为了避免 `socket` 玩家和 `bridge` 玩家在 15 秒结束后继续卡在 countdown，worker 侧需要有明确的权威切换触发点。推荐边界：
   - Durable Object alarm 在 `match.startedAt` 触发切换并广播。
   - 同时保留每次 `execute()` / `snapshot()` / `match.sync` 时的兜底“到点即提升”逻辑，避免 alarm 漏触发时状态卡死。
4. phase 切换到 `live` 后必须产生可传播的权威事件：
   - `socket` 客户端应收到 `match.event`
   - `bridge` 客户端应能通过定向 `match.sync` 尽快看到 `live`

### Client Routing And HUD

1. 房间页仍然沿用当前路由策略：一旦看到 `room.status === 'racing'`，符合资格的玩家进入 `/race/[code]`。
2. 比赛页在 `match.phase === 'countdown'` 时必须渲染居中倒计时遮罩层，建议展示：
   - `15 -> 6` 阶段：预备倒计时
   - `5 -> 1` 阶段：hero countdown
   - `0`：`GO!`
   - 辅助文案：`比赛即将开始`
3. `RaceHud` 在倒计时阶段应清楚展示当前阶段不是正式比赛，例如：
   - `阶段：发车倒计时`
   - 比赛计时固定显示 `00:00.000`
4. 中央倒计时层在 `5 -> GO!` 阶段必须带有明显的空间感与动势，默认按“朝镜头压近”的节奏设计，但不能造成眩晕或持续遮挡驾驶视线。
5. 中央倒计时层可以在 `0` 时短暂显示 `GO!` 或 `发车`，但必须在正式比赛可操作后及时消失，不能长期遮挡视野。
6. `GO!` 的停留时长应短于 `1` 秒，推荐 `300ms ~ 700ms`，避免挡住起跑第一段视野。
7. 倒计时期间允许弱化背景或加轻微 vignette / glow 来凸显主数字，但不能把赛道整体压暗到影响玩家辨认前方路线。
8. 最后 `5 -> GO!` 动画必须兼顾移动端：
   - 在窄屏上仍然居中完整可见
   - 不依赖 hover
   - 不使用会导致明显掉帧的超重粒子堆叠方案
9. 倒计时显示必须根据权威 `match.startedAt` 计算剩余时间，不能每次进入比赛页都重新从本地 `15` 秒开始。
10. 当前玩家一旦 `finishedAt` 存在且整局尚未结束，HUD 必须明确进入“已完赛，等待其他玩家/等待结算”状态。
11. 已完赛等待态的提示优先级低于发车倒计时主秀，但高于普通角落文案，避免玩家误以为自己还能继续开。

### Runtime Input Gate

1. legacy runtime 需要新增显式输入门禁能力，推荐任选一种稳定契约：
   - mount option: `inputEnabled`
   - runtime handle method: `setInputEnabled(enabled: boolean)`
   - runtime handle method: `setInputLocked(locked: boolean)`
2. React 层只负责根据比赛状态切换输入门禁，不直接改车辆物理细节。
3. runtime 在输入被锁定时必须把本地控制输入视为零输入：
   - `x = 0`
   - `z = 0`
   - `touchActive` 不能触发提前转向推进
4. 输入锁定阶段必须继续允许：
   - 场景渲染
   - 摄像机跟随
   - 远端影子车更新
   - HUD 更新
5. 输入锁定阶段不得触发本地推进音效、加速位移或基于输入的漂移效果。
6. 输入锁定至少覆盖两类场景：
   - `match.phase === 'countdown'`
   - 当前玩家 `finishedAt` 已存在且 `match.phase !== 'finished'`
7. 当前玩家完赛后，runtime 应进入“完赛锁车”状态：
   - 不再接受新的驾驶输入
   - 推荐把线速度/角速度快速收束到静止或近静止
   - 不允许通过惯性长距离继续漂移离开终点区域
8. 个人完赛锁车只影响当前玩家自己的本地车，不影响其他仍在比赛中的玩家继续正常驾驶。

### Telemetry And Synchronization

1. 倒计时阶段客户端不得发送 `match.progress`。
2. 若倒计时阶段仍收到错误或越界的 `match.progress`，worker 继续用现有 `MATCH_NOT_ACTIVE` 语义拒绝即可，不强制新增错误码。
3. `RaceClient` 当前按 `match.phase === 'live'` 才上报 telemetry 的门禁逻辑应保留，并明确覆盖 countdown。
4. 当前玩家一旦收到权威 `finishedAt`，客户端必须停止继续发送该玩家的 `match.progress`。
5. 完赛后的“停发 telemetry”必须以权威 match state 为准，不能只依赖本地一次 finish 上报成功后的乐观假设。
6. `bridge` 模式不能只靠现有 `5s` 周期轮询感知倒计时结束，否则玩家可能在 `15` 秒后还额外卡住几秒。需要补一个 countdown 专用同步动作：
   - 客户端根据权威 `match.startedAt` 安排一次到点 `match.sync`
   - 常规 `5s` 轮询继续保留为兜底
7. `socket` 模式下，比赛正式开始不应依赖客户端本地猜测时间点；应优先吃 coordinator 推送的 phase 切换事件。
8. `socket` 和 `bridge` 两种 transport 下，个人完赛后的锁车都必须由权威 match state 驱动，不能出现一端已经锁车、另一端还可继续操控的分叉。

### Persistence And Read Models

1. 本需求不要求新增 Supabase 表或字段。
2. `racing_rooms.started_at` 继续承载“房主点击发车 / 倒计时开始”的时间。
3. `racing_matches.started_at` 改为承载“正式比赛开始”的时间。
4. 结果页与完赛时间计算继续锚定 `match.startedAt`，因此本次改动后结果计时天然从倒计时结束开始，不需要再额外扣 15 秒。

## Edge Cases

- 玩家 A 在倒计时刚开始就进入比赛页，玩家 B 在第 12 秒才进入比赛页：
  两人都必须看到同一场比赛的同一权威剩余倒计时；B 只能看到剩余 `3` 秒左右，而不是重新从 `15` 开始。
- 玩家在倒计时阶段刷新页面：
  恢复后仍然落在同一个 countdown match，且车保持在起点锁定。
- `socket` 不可用、当前房间走 `bridge`：
  倒计时结束后仍需尽快切到 `live`，不能因为 `5s` 轮询粒度让正式发车再多延迟几秒。
- 玩家倒计时期间狂按按键或持续压住触控摇杆：
  倒计时结束前不能发生任何位移；正式开始后才允许这些输入在后续帧生效。
- 玩家率先冲线完成，但其他玩家还在跑：
  该玩家必须停在完赛等待态，不能继续开车兜圈，只能等待整局结束进入结果页。
- 玩家本地感觉自己冲线了，但权威 `finishedAt` 还没同步回来：
  最终仍以权威状态为准进入完赛锁车，避免客户端各自提前冻结或继续可控造成分叉。
- 房主发车时房间里还有没 ready 或没选车的成员：
  仍按当前既有规则不把他们带入比赛 roster，本次需求不扩大这个边界。
- 玩家在正式比赛已经开始后才完成比赛页加载：
  本次需求不保证其仍能与别人同时起跑；15 秒固定缓冲之外的极慢进入场景不额外延长比赛等待。

## Acceptance Criteria

1. 房主点击发车后，符合资格的玩家进入比赛页时，先看到居中的 `15` 秒倒计时，而不是立刻开始正式计时。
2. 倒计时阶段所有玩家都无法通过键盘、触控或手柄让赛车移动。
3. 倒计时阶段 HUD 的正式比赛时间保持未开始状态，不会提前累加。
4. 倒计时结束后，所有在线中的玩家才统一获得控制权并开始正式比赛计时。
5. 倒计时阶段刷新或重连不会把倒计时重置为新的 `15` 秒。
6. `socket` 和 `bridge` 两种 transport 下，正式发车都不会因为客户端本地实现差异出现“一端已开跑，另一端仍停在倒计时”的长期分叉。
7. 正式完赛时间以倒计时结束后的官方开赛时刻为起点，不包含前置 `15` 秒等待时间。
8. 当前“只允许已选车且已准备玩家进入比赛”的既有规则保持不变。
9. 最后 `5 -> 4 -> 3 -> 2 -> 1 -> GO!` 必须是独立的强视觉节拍，带明显 3D/空间层次感，而不是普通平面数字替换。
10. `15 -> 6` 阶段的预备倒计时不能持续用最大号重特效遮挡赛道；强视觉主秀只发生在最后 `5` 秒。
11. 任意玩家一旦权威完赛，该玩家自己的车必须立刻失去操控能力，并保持等待结算状态直到整局结束。
12. 已完赛玩家等待其他人时，比赛页必须明确提示“已完赛，等待其他玩家/等待结算”，且不能提前跳走。

## Verification Notes

- Suggested tests:
  - `realtime-worker/test/roomCoordinator.test.ts`
    - `room.start` 后应创建 `phase = 'countdown'` 的 match
    - `match.startedAt` 应晚于 `room.startedAt` 且差值为 `15000ms`
    - 到达 `match.startedAt` 后应切到 `live`
  - `src/components/RaceClient.test.tsx`
    - countdown 阶段不发送 `match.progress`
    - countdown 阶段显示中心倒计时
    - live 后才开始 telemetry
    - 当前玩家 `finishedAt` 出现后停止 telemetry
    - 当前玩家 `finishedAt` 出现后进入完赛等待提示
  - `js/Controls.test.ts`
    - 输入锁定时 keyboard / touch / gamepad 都返回零输入
    - 当前玩家完赛锁车时 keyboard / touch / gamepad 都返回零输入
  - `src/game/raceTiming.test.ts`
    - countdown 阶段比赛耗时保持 `0`
    - finished 结果仍基于正式 `match.startedAt`
- Suggested smoke checks:
  - 两个浏览器，一个快一个慢：
    - 房主发车后两端都先看到同一局倒计时
    - 慢端在倒计时期间进入时仍锁在起点
    - 倒计时结束后两端才都能真正起跑
  - `bridge` 强制降级场景：
    - 倒计时结束后不会额外卡住一个轮询周期

## Implementation Boundary

- This spec is intentionally spec-only.
- It locks lifecycle semantics, transport expectations, timer meaning, and acceptance criteria for the fair-start countdown feature.
- It does not authorize code changes until the user asks to continue into implementation.
