# Vercel Frontend + ECS Backend Deploy

## 架构

- 前端：`Vercel` 上的 `race-online2`
- 固定公开入口：`https://race2.pigou.top`（切流后）
- 预览入口：`https://race-online2.vercel.app`
- 实时入口：`wss://8.148.79.214/colyseus`
- 后端 API：`https://8.148.79.214/api/*`
- 后端健康检查：`https://8.148.79.214/api/health`
- ECS 角色：`Colyseus + HTTP API + MySQL + Nginx + PM2`

## Vercel 项目

- 老项目：`race-online`
  - GitHub 仓库：`zenggang/Starter-Kit-Racing`
  - Production Branch：`master`
  - 保持不动

- 新项目：`race-online2`
  - GitHub 仓库：`zenggang/Starter-Kit-Racing`
  - Production Branch：`Ali-init`
  - 用于新链路

## 服务器软件

- `Node.js 22`
- `npm` 或 `pnpm`
- `PM2`
- `Nginx`
- `MySQL`
- `Git`
- `UFW`
- 支持 IP 证书的 ACME 客户端

## MySQL 安装

```bash
sudo apt update
sudo apt install -y mysql-server
sudo mysql_secure_installation
```

## 创建数据库与用户

```sql
CREATE DATABASE race_game CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'race_user'@'localhost' IDENTIFIED BY 'strong_password_here';
GRANT ALL PRIVILEGES ON race_game.* TO 'race_user'@'localhost';
FLUSH PRIVILEGES;
```

## 前端环境变量

Vercel 项目 `race-online2`：

```env
NEXT_PUBLIC_COLYSEUS_URL=wss://8.148.79.214/colyseus
NEXT_PUBLIC_API_BASE_URL=https://8.148.79.214/api
SELF_HOSTED_SERVER_BASE_URL=https://8.148.79.214
```

说明：

- 浏览器端直接请求 ECS 的 `https://8.148.79.214/api/*`
- Next.js route handlers 保留为本地联调和兼容入口
- 浏览器实时连接直接使用 `wss://8.148.79.214/colyseus`

## 后端环境变量

`server/.env`：

```env
NODE_ENV=production
HOST=127.0.0.1
PORT=2567

MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_DATABASE=race_game
MYSQL_USER=race_user
MYSQL_PASSWORD=change_me

COLYSEUS_PUBLIC_URL=wss://8.148.79.214/colyseus
CORS_ORIGIN=https://race2.pigou.top,https://race-online2.vercel.app
```

## ECS 后端部署

```bash
cd /home/deploy/apps/games/race/server
npm install
npm run build
pm2 start npm --name race-colyseus -- run start
pm2 save
```

## ECS 上不再保留的前端运行时

后续应清理：

- `race-next` PM2 进程
- `.next` 前端产物
- 旧 `race2.pigou.top -> 127.0.0.1:3000` Nginx 站点
- 旧 ECS 前端启动脚本

## Nginx 方向

ECS 只保留 IP 入口：

- `https://8.148.79.214/api/*` -> `http://127.0.0.1:2567/api/*`
- `wss://8.148.79.214/colyseus` -> `http://127.0.0.1:2567`

关键点：

- `Nginx` 终止 TLS
- `Upgrade` / `Connection` 头必须正确透传给 WebSocket
- `2567` 只监听本机，不对公网开放
- `3306` 只监听本机，不对公网开放

## 证书

这轮不依赖 ECS 域名证书，改为依赖 `8.148.79.214` 的受信任 IP 证书。

要求：

- 不能使用自签名证书
- 需要可自动续期
- 续期后自动 reload `nginx`

## DNS

切流目标：

- `race2.pigou.top` -> `race-online2` 所在的 Vercel 项目
- 不再指向 ECS

ECS 本身不再要求新链路域名指向它。

## 防火墙

- 开放：`22`、`80`、`443`
- 不开放：`2567`
- 不开放：`3306`

## 内部连接

- `Nginx -> Node/Colyseus`：`127.0.0.1:2567`
- `Node/Colyseus -> MySQL`：`127.0.0.1:3306`
- `Browser/Vercel frontend -> ECS API`：`https://8.148.79.214/api/*`
- `Browser -> ECS realtime`：`wss://8.148.79.214/colyseus`
