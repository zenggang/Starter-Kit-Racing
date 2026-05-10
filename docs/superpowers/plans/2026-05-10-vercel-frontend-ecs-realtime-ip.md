# Starter-Kit-Racing Vercel Frontend + ECS Realtime/IP Execution Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` when executing this plan.

**Goal:** 在不影响老线上 `race-online/master` 的前提下，把 `Ali-init` 分支迁移到 `race-online2 (Vercel)` + `ECS(8.148.79.214) Colyseus/API/MySQL` 新体系，并先基于 `HTTPS/WSS IP` 跑通完整链路。

**Architecture:** 前端由新 Vercel 项目 `race-online2` 承载，ECS 不再运行 `Next.js` 前台；浏览器通过 `wss://8.148.79.214/colyseus` 直连实时服务，通过同源 `/api` 访问后端，Vercel 将 `/api/*` 反代到 `https://8.148.79.214/api/*`。老项目 `race-online` 继续由 `master` 自动部署，保持不动。

**Primary Spec:** [docs/specs/2026-05-10-vercel-frontend-ecs-realtime-ip-spec.md](/Users/javababy/Downloads/AI%20demo/Starter-Kit-Racing/docs/specs/2026-05-10-vercel-frontend-ecs-realtime-ip-spec.md:1)

---

## File Scope

### Must modify

- `src/config/env.ts`
- `src/config/env.test.ts`
- `src/realtime/sessionClient.ts`
- `src/realtime/useRoomSession.ts`
- `src/realtime/useMatchSession.ts`
- `src/app/api/rooms/route.ts`
- `src/app/api/tracks/route.ts`
- `src/app/api/tracks/[id]/route.ts`
- `README.md`
- `.env.example`
- `vercel.json` or equivalent Vercel routing config
- `docs/self-hosted-deploy.md`
- `docs/self-hosted-test-plan.md`

### Backend files to keep and finish

- `server/src/index.ts`
- `server/src/config.ts`
- `server/src/http/routes/*.ts`
- `server/src/rooms/RaceRoom.ts`
- `server/src/db/mysql.ts`
- `server/src/db/migrations/001_init.sql`
- `server/.env.example`

### ECS-only cleanup targets

- remove runtime dependency on `race-next`
- remove old ECS frontend startup commands
- remove old ECS frontend nginx site config
- keep only backend-facing nginx config for IP TLS + `/api` + `/colyseus`

### Legacy references kept but not runtime-critical

- `realtime-worker/*`
- `supabase/*`
- old docs/specs describing the self-hosted frontend approach

---

## Phase 0: Freeze Decision Boundary

- [ ] Confirm this plan executes against branch `Ali-init`
- [ ] Treat [docs/specs/2026-05-10-vercel-frontend-ecs-realtime-ip-spec.md](/Users/javababy/Downloads/AI%20demo/Starter-Kit-Racing/docs/specs/2026-05-10-vercel-frontend-ecs-realtime-ip-spec.md:1) as the only active migration baseline
- [ ] Treat [docs/specs/2026-05-09-self-hosted-ecs-colyseus-mysql-migration.md](/Users/javababy/Downloads/AI%20demo/Starter-Kit-Racing/docs/specs/2026-05-09-self-hosted-ecs-colyseus-mysql-migration.md:1) as superseded background only

Exit criteria:

- 后续所有实现、部署、验收都不再使用 “ECS 前端自托管” 口径

---

## Phase 1: Normalize Frontend Runtime Contract

Objective:

- 把前端运行时配置改成适配 `Vercel + ECS IP`

Tasks:

- [ ] 将前端公开配置统一收口到 `src/config/env.ts`
- [ ] 把默认实时地址调整为 `wss://8.148.79.214/colyseus`
- [ ] 把默认 API 地址调整为同源 `/api`
- [ ] 清理仍残留的 `race2.pigou.top` / `game.pigou.top` 新链路硬编码
- [ ] 保留现有内部状态式导航，不改公开 URL 体验

Expected config direction:

```env
NEXT_PUBLIC_COLYSEUS_URL=wss://8.148.79.214/colyseus
NEXT_PUBLIC_API_BASE_URL=/api
```

Exit criteria:

- 本地 build 后，前端所有新链路配置都来源于统一配置层

---

## Phase 2: Stabilize ECS Backend Only

Objective:

- 让 ECS 只承担实时/API/数据库角色，不再跑前端

Tasks:

- [ ] 审计并确认 `server/` 当前代码结构仍是可继续沿用的基线
- [ ] 修完 `POST /api/rooms` 等当前已知后端阻塞点
- [ ] 确保 `/health`、`/api/rooms`、`/api/tracks`、`/api/leaderboard`、`/api/race-records` 可用
- [ ] 确保 `Colyseus race_room` 可 join/create/start
- [ ] 确保 MySQL migration、连接与结果写入稳定

ECS runtime target:

- `127.0.0.1:2567` 监听 Node/Colyseus
- `127.0.0.1:3306` 监听 MySQL
- Nginx 对外提供：
  - `https://8.148.79.214/api/*`
  - `wss://8.148.79.214/colyseus`

Exit criteria:

- 不经过 Vercel，直接打 ECS IP 也能通过健康检查和受控接口验证

---

## Phase 3: IP TLS and Nginx Boundary

Objective:

- 把 ECS IP 边界做成浏览器可信的 `HTTPS/WSS`

Tasks:

- [ ] 给 `8.148.79.214` 申请并安装浏览器可接受的 IP 证书
- [ ] Nginx 正确终止 TLS
- [ ] Nginx 反代 `/api/*` 到 `127.0.0.1:2567/api/*`
- [ ] Nginx 反代 `/colyseus/*` 到 `127.0.0.1:2567/*`
- [ ] 校验 WebSocket upgrade 头和超时设置
- [ ] 保持只开放 `22/80/443`

Exit criteria:

- 浏览器与命令行都能成功访问：
  - `https://8.148.79.214/api/health`
  - `wss://8.148.79.214/colyseus`

---

## Phase 4: Create and Configure New Vercel Project

Objective:

- 建立与老项目隔离的新前端托管项目

Tasks:

- [ ] 创建新的 Vercel 项目 `race-online2`
- [ ] 指向当前 GitHub 仓库
- [ ] 将 Production Branch 设为 `Ali-init`
- [ ] 保持老项目 `race-online` 仍绑定 `master`
- [ ] 在 `race-online2` 配置前端环境变量
- [ ] 配置 `/api/:path* -> https://8.148.79.214/api/:path*` rewrite

Vercel-side config target:

- Frontend:
  - `NEXT_PUBLIC_COLYSEUS_URL=wss://8.148.79.214/colyseus`
  - `NEXT_PUBLIC_API_BASE_URL=/api`
- Routing:
  - `/api/:path*` external rewrite to ECS IP

Exit criteria:

- `race-online2.vercel.app` 成功部署并能访问前端

---

## Phase 5: End-to-End Frontend Integration

Objective:

- 让前端真正切到 ECS 新链路，但不动玩法核心

Tasks:

- [ ] 确保大厅房间列表从新 `/api` 获取
- [ ] 确保建房/进房走新接口与新 Colyseus 连接
- [ ] 确保准备、切车、切颜色、退出等房间操作恢复可用
- [ ] 确保比赛页不再卡在“接入比赛状态”
- [ ] 确保结果页、排行榜、赛道编辑器使用新数据链路
- [ ] 不重写 `js/*` 赛车玩法运行时，只做必要接入性修复

Exit criteria:

- 从大厅到比赛再到结果页，全链路基于新体系可跑通

---

## Phase 6: ECS Cleanup

Objective:

- 清掉不再需要的 ECS 前端运行环境

Tasks:

- [ ] 下线 `race-next` 前端 PM2 进程
- [ ] 删除或归档 ECS 上不再使用的 `.next` 产物
- [ ] 删除旧 ECS 前端启动脚本
- [ ] 删除旧 `race2.pigou.top` / `game.pigou.top` 站点配置
- [ ] 保留后端所需 `pm2`, `nginx`, `mysql`, `node`

Exit criteria:

- ECS 上只剩后端相关长期进程

---

## Phase 7: Docs and Handover

Objective:

- 文档口径全部切到新方案

Tasks:

- [ ] 更新 [docs/self-hosted-deploy.md](/Users/javababy/Downloads/AI%20demo/Starter-Kit-Racing/docs/self-hosted-deploy.md:1) 到 `Vercel 前端 + ECS IP 后端`
- [ ] 更新 [docs/self-hosted-test-plan.md](/Users/javababy/Downloads/AI%20demo/Starter-Kit-Racing/docs/self-hosted-test-plan.md:1)
- [ ] 更新 [README.md](/Users/javababy/Downloads/AI%20demo/Starter-Kit-Racing/README.md:1) 中关于 live demo、架构和环境变量的表述
- [ ] 补齐 `race-online2` 的 Vercel 配置说明
- [ ] 补齐 ECS 上 IP 证书续期说明

Exit criteria:

- 新人只看文档，也不会再走到 “ECS 前端自托管” 老路线

---

## Validation Matrix

### Local

- [ ] `npm run build`
- [ ] `npm test`
- [ ] `npm --prefix server run build`

### ECS direct

- [ ] `https://8.148.79.214/api/health`
- [ ] `https://8.148.79.214/api/rooms`
- [ ] `wss://8.148.79.214/colyseus`

### Vercel preview / production

- [ ] `race-online2.vercel.app`
- [ ] `race2.pigou.top` 指向新 Vercel 项目后可访问
- [ ] `/api/*` 经 Vercel 代理后行为正常

### Browser game flow

- [ ] 打开大厅
- [ ] 创建房间
- [ ] 操作房间按钮
- [ ] 进入比赛
- [ ] 完成比赛
- [ ] 查询结果

---

## Risks

- IP 证书是短周期机制，续期自动化必须先做稳
- 微信内置浏览器对证书和 WebSocket 的容忍度低于桌面浏览器
- 现有 ECS 上残留的旧前端配置如果不清掉，容易再次干扰排查
- `Ali-init` 当前工作区已有较多迁移痕迹，执行时必须严格最小范围收口

---

## Recommended Execution Order

1. 先修稳 ECS backend 与 `POST /api/rooms` 这类已知硬问题
2. 再完成 ECS IP TLS 与 Nginx 边界
3. 再创建 `race-online2` 并接 GitHub 自动部署
4. 再切前端配置与 `/api` 反代
5. 再做浏览器联调
6. 最后清理 ECS 上旧前端运行环境和过时文档

---

## Manual Inputs Needed Later

- Vercel 账号/Team 下创建 `race-online2` 的权限
- GitHub 仓库已可被新 Vercel 项目导入
- `race2.pigou.top` 切到 Vercel 时的 DNS 修改窗口
- ECS 上 IP 证书自动续期方式确认

---

## Definition of Done

以下条件全部满足，才算这轮迁移完成：

- 老 `race-online/master` 继续可用且未被破坏
- 新 `race-online2/Ali-init` 可独立部署
- 浏览器从 Vercel 前端成功连到 ECS 的 `HTTPS/WSS IP`
- ECS 不再承担前端运行时
- 游戏核心玩法与渲染主干保持原状，仅基础设施完成替换
