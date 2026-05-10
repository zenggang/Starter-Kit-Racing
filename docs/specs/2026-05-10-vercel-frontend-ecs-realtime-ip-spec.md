# Starter-Kit-Racing Vercel Frontend + ECS Realtime/IP Spec

日期：`2026-05-10`
状态：`ready-for-planning`
分支：`Ali-init`

> 本 spec 取代 `docs/specs/2026-05-09-self-hosted-ecs-colyseus-mysql-migration.md` 作为后续迁移基线。
> 旧 spec 的核心问题不是 `Colyseus + MySQL` 路线错误，而是把 `Next.js` 前端运行时也强塞进 ECS，导致部署、证书、入口和联调复杂度过高。

## 1. 背景

当前老线上体系保持不动：

- Vercel：老前端项目 `race-online`
- Cloudflare Worker：老实时链路
- Supabase：老持久化
- 生产分支：`master`

本分支 `Ali-init` 的目标调整为：

- 前端重新回到 `Vercel` 托管
- ECS 回归“实时服务器 + API + MySQL”定位
- 不再让 ECS 承担 `Next.js` 前台运行时
- 不再让浏览器依赖 ECS 域名，避免阿里云备案拦截问题

## 2. 目标

在不动老线上 `race-online/master` 的前提下，新建一套独立的新链路：

- 新 Vercel 项目：`race-online2`
- 新前端入口：由 `race-online2` 承载
- 新实时层：ECS 上的 `Colyseus`
- 新持久化：ECS 上的 `MySQL`
- 新 API：ECS 上的 Node 服务

并尽量保留现有玩法、渲染、赛车逻辑、资源和交互语义。

## 2.1 本轮要锁死的结果

本轮规范确认后，后续实现必须以这 5 条为准：

- 老 Vercel 项目 `race-online` 不动，继续由 `master` 自动部署
- 新 Vercel 项目 `race-online2` 独立创建，生产分支先指向 `Ali-init`
- `race2.pigou.top` 后续改指向 `race-online2`，不再指向大陆 ECS
- ECS 只保留 `Colyseus + API + MySQL + Nginx + PM2`
- 浏览器与 ECS 的运行时连接统一基于 `8.148.79.214` 的 `HTTPS/WSS`

## 3. 核心决策

### 3.1 前端重新回到 Vercel

本轮不再把前端部署在 ECS。

原因：

- 当前仓库真实前端是 `Next.js App Router`，不是简单静态站。
- 把前端重新放回 Vercel，可以恢复稳定的前端构建、静态资源分发、HTTPS 和回滚能力。
- ECS 只保留最需要它承担的部分：实时、API、数据库。

最终职责边界：

- Vercel：前端页面、静态资源、同源入口
- ECS：`Colyseus + MySQL + HTTP API`

### 3.2 ECS 不再依赖域名，运行时统一走 IP

新链路中，ECS 不再要求 `game.pigou.top` 或 `race2.pigou.top` 指向它。

运行时口径改为：

- ECS 对浏览器暴露的对外地址，统一基于公网 IP `8.148.79.214`
- 浏览器实时连接目标：`wss://8.148.79.214/colyseus`
- 浏览器 API 目标：由 Vercel 同源 `/api` 反代到 `https://8.148.79.214/api`

这里必须明确一个技术约束：

- 如果前端页面跑在 `https://...` 下，浏览器不能安全地连 `ws://IP` 或请求 `http://IP`
- 因此 ECS 的 IP 入口必须具备 TLS
- 这轮“IP 入口”成立的前提，是 ECS 侧使用受浏览器信任的 IP 证书，而不是自签名证书
- 也就是说，本 spec 里的“用 IP 连接即可”，正确实现不是裸 `http/ws`，而是：
  - `https://8.148.79.214/api`
  - `wss://8.148.79.214/colyseus`

### 3.3 不依赖 Vercel 充当 WebSocket 服务器

Vercel 项目不承接 WebSocket server 本体。

本轮不采用这些做法：

- 不把 `Colyseus` 放进 Vercel Functions
- 不把实时主状态放回 Vercel server runtime
- 不把关键实时连接建立在“也许能代理 WebSocket”的不确定链路上

实时连接直接由浏览器连 ECS 的 `wss://8.148.79.214/colyseus`。

### 3.4 API 通过 Vercel 同源入口代理到 ECS

前端不直接把 `https://8.148.79.214/api` 硬编码到各处业务代码。

推荐口径：

- 浏览器代码统一请求同源 `/api/*`
- `race-online2` 项目通过 `vercel.json` 或等效 rewrites，将 `/api/:path*` 反代到 `https://8.148.79.214/api/:path*`

这样做的好处：

- 前端代码更干净
- 不暴露过多后端地址细节到业务层
- 前端与 API 保持同源调用体验
- 后续如果 ECS IP 变化，只需要改代理配置和环境变量，不需要业务代码到处改

### 3.5 老的 Vercel 项目 `race-online` 保持不动

明确锁死：

- 现有 Vercel 项目 `race-online` 不做迁移实验
- `master` 分支继续服务老线上链路
- 不修改老项目的域名、环境变量、构建命令和自动部署口径

新链路全部放到新项目 `race-online2`。

## 4. Vercel 项目策略

### 4.1 项目拆分

保留并行两套 Vercel 项目：

- `race-online`
  - 对应老体系
  - 生产分支：`master`
  - 继续自动部署老线上

- `race-online2`
  - 对应新体系
  - 指向同一个 GitHub 仓库
  - 生产分支：推荐先直接用 `Ali-init`

### 4.2 部署方式结论

对于你问的“后续怎么部署 Vercel”，本 spec 的结论是：

- **采用 GitHub 分支自动部署**
- **不采用我本地打包后手动上传部署**

推荐理由：

- 这是 Vercel 最稳定、最可回滚、最符合日常维护习惯的方式
- 新旧项目都可以继续从同一个仓库自动化部署，但分别盯不同分支
- `race-online2` 的 Preview / Production 边界更清晰
- 便于你后续自己看 Deployment 历史、回滚、切环境变量、看日志

因此项目映射建议固定为：

- `race-online` -> GitHub repo -> branch `master`
- `race-online2` -> GitHub repo -> branch `Ali-init`

后续如果你想把 `Ali-init` 收口成更干净的长期分支，可以再把 `race-online2` 的 Production Branch 切到新的稳定分支，但不是这一轮的必要动作。

### 4.2.1 为什么不采用“本地打包后上传部署”

这轮明确不采用人工打包上传到 Vercel，原因是：

- 会绕开 GitHub 分支与 Deployment 历史，后续回滚不直观
- 容易出现“本地构建内容”和“仓库真实代码”不一致
- 不利于把 `race-online` 与 `race-online2` 两个项目长期并行维护

因此后续执行口径固定为：

- 代码合入 `Ali-init`
- GitHub 触发 `race-online2` 自动部署
- 通过 Vercel 的 Preview / Production 验证新链路

### 4.3 新前端公开入口

推荐顺序：

- 正式入口：`race2.pigou.top` 指向 `race-online2` 的 Vercel 项目
- 验证入口：`race-online2.vercel.app`

这里和之前不同的是：

- `race2.pigou.top` 不再指向阿里云 ECS
- `race2.pigou.top` 改为指向 Vercel

因此：

- 它不再触发“阿里云机器上未备案域名直接对外”的那类拦截场景
- ECS 自己不再承担这个域名入口

## 5. ECS 目标定位

### 5.1 ECS 只保留这些职责

ECS 只保留：

- `Colyseus`
- 后端 HTTP API
- `MySQL`
- 反向代理与 TLS 终止
- 进程守护

### 5.2 ECS 需要保留的环境

保留：

- `Node.js 22`
- `npm` 或 `pnpm`（二选一即可）
- `PM2`
- `MySQL`
- `Nginx`
- 支持 IP 证书的 ACME 客户端
- `Git`
- `UFW`

### 5.3 ECS 上应移除的非必要内容

后续应清理：

- ECS 上的前端 `Next.js` 生产运行进程
- 为 ECS 前端站点准备的 `.next` 产物和相关启动脚本
- `race-next` 这类前台进程
- 仅服务于 `race2.pigou.top` / `game.pigou.top` 域名入口的旧 Nginx 站点配置
- 与前端自托管方案绑定的旧部署文档和脚本

### 5.4 ECS 暂不移除的内容

这些可以先不删或只做归档：

- 旧 Cloudflare Worker 代码
- 旧 Supabase 代码
- 本地迁移期间新增的 server 代码

原因：

- 它们仍有迁移参考价值
- 运行时不再依赖，不等于必须立即从仓库物理删除

## 6. 新链路拓扑

```text
浏览器
  -> https://race2.pigou.top                (Vercel: race-online2)
  -> /api/*                                 (Vercel external rewrite -> ECS IP)
  -> wss://8.148.79.214/colyseus            (直连 ECS)

Vercel
  -> GitHub repo / branch Ali-init 自动部署
  -> rewrites /api/* -> https://8.148.79.214/api/*

ECS (8.148.79.214)
  -> Nginx
     -> /api/* -> 127.0.0.1:2567/api/*
     -> /colyseus/* -> 127.0.0.1:2567/*
  -> Colyseus/Node backend (127.0.0.1:2567)
  -> MySQL (127.0.0.1:3306)
```

## 7. 前端运行时约束

### 7.1 公开 URL 体验

保持现有游戏产品体验：

- 用户公开入口固定在一个前端 URL 上
- 大厅、房间、比赛、结果页、赛道编辑器继续尽量走内部状态式导航
- 不因为迁移到 Vercel 就重新把体验做成“像普通网站那样不断切浏览器路径”

### 7.2 前端环境变量方向

前端推荐环境变量：

```env
NEXT_PUBLIC_COLYSEUS_URL=wss://8.148.79.214/colyseus
NEXT_PUBLIC_API_BASE_URL=/api
```

说明：

- `NEXT_PUBLIC_API_BASE_URL=/api` 让浏览器统一走同源 API
- `/api` 再由 Vercel 反代到 ECS IP
- `NEXT_PUBLIC_COLYSEUS_URL` 直接指向 ECS IP 的 `wss`

## 8. 后端运行时约束

### 8.1 后端监听方式

后端 Node / Colyseus 继续只监听本机：

- `HOST=127.0.0.1`
- `PORT=2567`

Nginx 作为唯一对外入口：

- `443` 终止 TLS
- `/api/*` 反代到本机后端
- `/colyseus/*` 反代到本机后端

### 8.2 MySQL 约束

保持：

- `127.0.0.1:3306`
- 不公网开放 `3306`

### 8.3 防火墙约束

保持：

- 对公网只开放 `22`、`80`、`443`
- 不开放 `2567`
- 不开放 `3306`

## 9. 代码范围

### 9.1 需要尽量保留的核心代码

保留优先级最高：

- `js/*` 赛车运行时
- `src/game/*`
- 房间、比赛、结果、赛道编辑等前端页面壳
- 与玩法、渲染、赛道、车辆、资源直接相关的逻辑

### 9.2 需要替换的基础设施层

替换重点：

- 前端到 ECS 的实时入口配置
- 前端到持久化接口的访问路径
- 旧 `Worker + Supabase` 运行时依赖
- 旧 `Next.js on ECS` 这条部署口径

## 10. Non-Goals

本轮明确不做：

- 不动老 `race-online/master`
- 不重写赛车玩法
- 不重写地图、资源、渲染体系
- 不把 `Cloudflare Worker` 当成新运行时依赖
- 不把 `Supabase` 当成新运行时依赖
- 不让前端直接连 MySQL
- 不把 `2567` / `3306` 暴露公网

## 11. 风险与约束

### 11.1 最大技术约束

这轮最重要的约束是：

- Vercel 前端一旦走 HTTPS，浏览器就不能使用不安全的 `http://IP` 或 `ws://IP`
- 所以 ECS 的 IP 入口必须具备可信 TLS

也就是说：

- “ECS 不用域名”是可行的
- 但“ECS 只用裸 HTTP/WS”不可行

### 11.2 不依赖不确定链路

这轮不把“让 Vercel 去承接 WebSocket server 或不确定的 WebSocket 代理链”当成方案基石。

必须保证：

- `Colyseus` 真正跑在 ECS
- 浏览器能直接建立 `wss://8.148.79.214/colyseus`

### 11.3 大陆 ECS 的长期定位

这轮方案成立，不代表它是长期最优终局。

当前判断是：

- 短期内，继续用这台大陆 ECS 跑通新链路是可接受的
- 长期看，如果后续仍频繁受到备案、证书、微信兼容等问题影响，再考虑迁移到香港或海外节点

也就是说，这一轮先按“现有 ECS + IP TLS”跑通，不在 spec 阶段直接扩成换机项目。

### 11.4 旧文档将过时

现有仓库里凡是写着这些口径的文档，后续都需要更新：

- `race2.pigou.top` 指向 ECS
- `game.pigou.top` 作为新链路实时入口
- ECS 自托管前端

这些都不再是新方案。

## 12. 验收标准

### 12.1 Vercel 侧

满足以下条件才算前端链路正确：

1. 已创建新的 Vercel 项目 `race-online2`
2. `race-online` 仍绑定 `master`，不受影响
3. `race-online2` 绑定同一 GitHub 仓库，但生产分支为 `Ali-init`
4. `race-online2` 成功自动部署
5. `race2.pigou.top` 或 `race-online2.vercel.app` 可访问前端

### 12.2 ECS 侧

满足以下条件才算 ECS 角色正确：

1. ECS 上不再运行前端 `Next.js` 生产进程
2. ECS 仅保留 `Colyseus + API + MySQL + Nginx + PM2`
3. `https://8.148.79.214/api/health` 或等效健康接口可返回 `ok: true`
4. `wss://8.148.79.214/colyseus` 可建立连接
5. `3306` 与 `2567` 不公网开放

### 12.3 游戏链路

满足以下条件才算新体系跑通：

1. 前端能打开大厅
2. 房间列表能正常读取
3. 可以创建房间并进入房间
4. 房间内准备、切车、切颜色、退出等操作可用
5. 能进入比赛
6. 比赛实时同步正常
7. 比赛结果能写入 MySQL 并可查询

## 13. 实施顺序建议

后续真正实现时，建议按这个顺序：

1. 先把本 spec 作为新基线锁定
2. 先清理并收缩 ECS 角色，只保留后端职责
3. 建立 ECS 的 `https://IP` 与 `wss://IP` 能力
4. 创建新 Vercel 项目 `race-online2`
5. 配好 `Ali-init` 自动部署与 `/api` 反代
6. 最后替换前端环境变量并联调整条游戏链路

## 14. 本轮结论

这轮新的方向不是“放弃 Vercel”，而是：

- **前端回 Vercel**
- **ECS 回归实时服务器**
- **ECS 运行时不用域名，改走带 TLS 的 IP 入口**
- **老 `race-online/master` 完全不动**
- **新 `race-online2/Ali-init` 独立演进**
