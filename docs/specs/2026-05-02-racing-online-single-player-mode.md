# Racing Online Single-Player Mode

## Context

- Background:
  当前仓库已经有在线大厅、房间页、比赛页、结果页和 coordinator / Supabase 基础结构，但多人在线主链路还不稳定，继续直接推进多人模式容易在 transport、房间同步、比赛态和结果持久化上反复返工。
- Existing problem:
  现阶段既想验证在线底层，又被多人同步问题持续打断。这样会把“单机 runtime 接壳是否成立”“房间到比赛到结果是否完整”“ticket / bridge / coordinator / Supabase 链路是否闭环”这些更基础的问题和多人一致性问题搅在一起。
- Why this spec exists:
  先把“单人在线模式”整体跑通，验证从界面、房间、开赛、比赛、完赛、结果到重开的整条在线底层。只有这条单人在线主链路稳定，后续多人模式才有可靠的落脚点。

## Goal

- Primary outcome:
  在不新增独立入口的前提下，把当前在线房间规则临时收口为“允许房主单人发车”，并完整打通单人在线主链路。
- User-visible result:
  用户通过现有 `/hall -> /room/[code]` 流程创建一个在线房间后，即使房间内只有自己一人，也可以完成：
  - 选车
  - 准备
  - 发车
  - 进入比赛
  - 按真实圈数完赛
  - 自动进入结果页
  - 从结果页重新开始或返回大厅

## Relationship To Existing Realtime Foundation Spec

- This spec narrows the delivery target of [2026-04-26-racing-online-realtime-foundation.md](/Users/javababy/Downloads/AI demo/Starter-Kit-Racing/docs/specs/2026-04-26-racing-online-realtime-foundation.md).
- It does not replace the long-term multiplayer goal.
- It temporarily changes the validation order:
  1. 先完成单人在线模式
  2. 再基于这条已跑通的底层回到多人在线模式
- When this spec conflicts with the broader multiplayer spec, this spec wins for the current delivery slice.

## Scope

- In scope:
  - 继续使用现有首页、大厅、房间、比赛、结果页面，不新增“单人在线”独立入口。
  - 在线房间规则临时调整为：房主单人即可发车。
  - 保留现有房间预备动作：`选车 -> 准备 -> 发车`。
  - 单人比赛必须按真实圈数完成，不允许只靠临时按钮直接跳结果。
  - 保留当前在线底层结构：
    - `Next.js/Vercel` 页面与 API 壳
    - `coordinator-ticket`
    - same-origin bridge
    - coordinator
    - Supabase durable read model / result persistence
  - 保留移动端优先的界面与触控控制要求。
  - 保留默认赛道作为这次验收主赛道。
- Affected modules or surfaces:
  - `/hall`
  - `/room/[code]`
  - `/race/[code]`
  - `/result/[code]`
  - room lifecycle rule
  - match lifecycle rule
  - runtime adapter
  - result persistence

## Non-goals

- Explicitly out of scope:
  - 本次不要求多人在线正确性。
  - 本次不要求两个玩家同时在线时的房间同步、比赛同步、排行榜一致性已经正确。
  - 本次不要求 socket 模式完整可用；bridge 可稳定跑通即可。
  - 本次不要求完整权威物理、预测、回滚或反作弊。
  - 本次不要求自定义赛道房间流完整可用。
  - 本次不要求为单人在线模式新增首页入口、快捷入口或新的房型概念。

## Functional Requirements

1. 在线大厅入口不变。
   - 用户仍从现有 `/hall` 创建房间。
   - 不新增“单人在线试跑”独立按钮或独立房型。

2. 房间规则临时调整为允许单人发车。
   - 当前房间内只要有房主一人，且房主已选择颜色并点击准备，就允许点击发车。
   - 不再要求“至少 2 名车手才能发车”作为当前交付门槛。

3. 房间预备流程必须保留。
   - 创建房间后，用户仍必须经过：
     - 选择赛车颜色
     - 点击准备
     - 点击发车
   - 不允许把单人在线模式简化成“创建后自动发车”或“无需准备”。

4. 比赛必须按真实圈数完成。
   - 房主在房间页设置的 `lapTarget` 仍然生效。
   - 比赛只有在达到真实完赛条件后才进入结果页。
   - 不允许通过临时“结束比赛”按钮模拟完赛。

5. 结果页必须是单人在线主链路的一部分。
   - 比赛完成后自动跳转 `/result/[code]`。
   - 结果页至少显示：
     - 玩家昵称
     - 名次
     - 完成圈数
     - 完赛状态
   - 结果页必须提供：
     - 重新发车
     - 返回大厅

6. 单人在线模式必须继续走在线底层，而不是回退到本地 demo。
   - 必须继续使用：
     - `/api/coordinator-ticket`
     - same-origin bridge
     - coordinator state
     - Supabase durable room/match/result persistence
   - 不能因为只有一名玩家就绕过 coordinator 或绕过持久化。

7. 浏览器端仍必须消费统一 session 语义。
   - 房间阶段消费 `room.snapshot` / `command.result`
   - 比赛阶段消费 `match.snapshot` / `match.event` / `command.result`，或在 bridge 模式下消费与之等价的 snapshot refresh

8. 结果持久化必须成立。
   - 至少要有 durable match header 和 per-player durable result。
   - 页面刷新后，结果页所依赖的数据不能只存在于浏览器内存里。

## Behavioral Details

- Entry flow:
  - `/` -> `/hall`
  - `/hall` 创建房间
  - `/room/[code]` 选择颜色、准备、发车
  - `/race/[code]` 进行比赛
  - `/result/[code]` 查看结果

- Single-player room semantics:
  - room roster 可以只有房主一人
  - 房主颜色必选
  - 房主 ready 必须显式成立
  - 房主发车后立即进入比赛态

- Race semantics:
  - 单人比赛仍要产生完整 match state
  - 比赛进度由 runtime adapter 产生 telemetry，再送入 coordinator
  - 完赛判定必须基于真实圈数达成
  - 完赛后 coordinator 产出最终结果并结束 match

- Result semantics:
  - 单人结果页仍视为一场完整在线比赛结果
  - `rank` 固定为 `1`
  - 若单人未真实完赛，不应进入“正常结果页”

## Edge Cases

- 房主进入房间后未选车：
  - 不能发车

- 房主已选车但未准备：
  - 不能发车

- 房主比赛中刷新页面：
  - 必须能恢复比赛页或至少恢复到正确的在线状态，而不是丢失为本地单机页

- 房主完赛前刷新结果相关数据：
  - 不应提前看到“已完赛”结果

- 房主完赛后刷新结果页：
  - 应能恢复结果，而不是只看到空白页面或返回大厅

- 房主完赛后选择重新发车：
  - 应回到房间等待态或等价的可再次发车状态
  - 不应覆盖历史结果记录

- 若第二个玩家在单人在线模式流程中进入同一房间：
  - 这次 spec 不要求多人行为正确
  - 但系统不应因为第二个人进入就把单人主链路完全卡死

## Constraints

- Technical constraints:
  - 尽量复用现有 `js/*.js` runtime，不做无必要的全量重写
  - 不新增新的房型概念或新的入口分支
  - 继续优先使用 bridge 路径完成房间和比赛主链路

- Product constraints:
  - 用户操作心智保持不变：仍然是“创建房间 -> 房间里准备 -> 发车”
  - 不因为单人模式就把房间页改成完全不同的交互模型

- Verification constraints:
  - 这次验收只看单人在线 happy path
  - 多人在线同步问题在本 spec 中不作为阻断项

## Acceptance Criteria

1. 配齐在线环境变量并部署后，单个浏览器客户端可以完成：
   - 进入大厅
   - 创建房间
   - 选择颜色
   - 点击准备
   - 单人发车
   - 进入比赛页
   - 按真实圈数完成比赛
   - 自动进入结果页
   - 结果页重新发车或返回大厅

2. 单人发车不需要第二名玩家加入。

3. 房间页文案和按钮状态必须清楚表达：
   - 单人也可以发车
   - 但仍需要先选车并准备

4. 比赛页不能是黑屏或空壳。
   - 必须能看到赛道与车辆
   - 触控或键盘控制必须可用

5. 完赛必须是“真实完赛”。
   - 系统根据真实圈数进入结果页
   - 不能依赖临时跳转或手动结束

6. 结果页刷新后仍能恢复结果数据。

7. 至少以下本地验证必须通过：
   - `npm run lint`
   - `npm test`
   - `npm run build`
   - `cd realtime-worker && npm test`
   - `cd realtime-worker && npm run typecheck`

8. 最终还必须有一轮真实单人在线 smoke：
   - create room
   - choose color
   - ready
   - start
   - finish
   - result
   - rematch or back to hall

## Non-acceptance Signals

- 仍然要求至少 2 人才能发车
- 发车后比赛页是黑屏、空白页或只剩 HUD 没有赛道
- 比赛结束后没有结果页
- 结果页只能靠内存显示，刷新就丢
- 单人 happy path 仍被多人同步问题阻断

## Open Questions Deferred

- 多人在线模式最终是 bridge-first 还是 socket/bridge 双活
- 多人比赛的排行榜排序规则细节
- 多人比赛的 presence / disconnect / reconnect 最终语义
- 自定义赛道房间 UI 何时开放
- 是否要把赛车状态进一步收口到更强的 coordinator authority

## Verification Notes

- 这次的验证目标不是“多人在线没 bug”，而是“单人在线链路完整成立”。
- 所有实现与验证都应优先回答一个问题：
  - “如果现在只有一个玩家在线，这条链从房间到结果是否完整、稳定、可恢复？”

## Exit Condition

当且仅当下面这件事稳定成立，才算本 spec 完成：

> 一个玩家通过现有在线大厅创建房间后，在没有第二名玩家加入的情况下，也能完成一次真实在线比赛，并进入可恢复的结果页。
