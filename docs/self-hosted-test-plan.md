# Vercel Frontend + ECS Backend Test Plan

## 基础设施

1. `MySQL` 可本机连接
2. `server/src/db/migrations/001_init.sql` 可执行
3. `race-colyseus` 可启动
4. `https://8.148.79.214/api/health` 返回 `ok: true`

## ECS API

1. `https://8.148.79.214/api/rooms` 返回正常
2. `https://8.148.79.214/api/tracks` 可创建、读取、更新、删除
3. `https://8.148.79.214/api/leaderboard` 返回正常
4. `https://8.148.79.214/api/race-records` 返回正常

## Vercel 前端

1. `race-online2` 项目成功导入并部署
2. `race-online` 仍保持原有 `master` 自动部署，不受影响
3. `race-online2.vercel.app` 可访问
4. `race2.pigou.top` 切到新项目后可访问
5. 浏览器地址栏在大厅、房间、比赛、结果页、赛道编辑器全程保持固定入口

## 实时链路

1. 浏览器可连接 `wss://8.148.79.214/colyseus`
2. 创建房间成功
3. 输入房间码加入成功
4. 自动选色成功
5. 自动准备 / 取消准备正常
6. 发车成功
7. 比赛中 telemetry 正常上报
8. 完赛后结果页正常展示

## 同源 API 代理

1. 浏览器请求 `/api/rooms` 时，Next.js route handlers 能成功代理到 ECS
2. 浏览器请求 `/api/tracks` 时，Next.js route handlers 能成功代理到 ECS
3. 浏览器请求 `/api/leaderboard` 时，Next.js route handlers 能成功代理到 ECS
4. 浏览器请求 `/api/race-records` 时，Next.js route handlers 能成功代理到 ECS
5. 浏览器请求 `/api/health` 时，能返回 ECS 后端健康状态

## 网络边界

1. `2567` 未对公网开放
2. `3306` 未对公网开放
3. ECS 上已不再依赖 `race2.pigou.top` / `game.pigou.top` 作为新链路入口
4. ECS IP 证书在桌面浏览器下可信
