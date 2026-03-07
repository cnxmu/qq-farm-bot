# QQ 农场多账号挂机 + Web 面板

基于 Node.js 的 QQ 农场自动化工具，支持多账号管理、Web 控制面板、实时日志与数据分析。

> 仅供学习与研究用途。使用本工具可能违反游戏服务条款，请自行评估风险。

新 qq农场游戏交流群：1077372084  
[Discord](https://discord.gg/jSp8vrzv)

---

## 1. 项目简介

本项目包含两个部分：

- `core`：后端与挂机运行时（账号管理、任务调度、接口服务、日志推送）
- `web`：前端控制台（账号管理、状态看板、农场/好友/背包/分析/设置）

后端启动后会托管前端构建产物，默认通过同一个端口（`3000`）对外提供服务。

---

## 2. 项目功能说明

### 多账号管理
- 账号新增、编辑、删除、启动、停止
- 扫码登录（QQ 小程序）与手动输入 Code
- 账号被踢下线自动停止
- 账号离线超时自动删除（按配置）

### 自动化能力
- 农场：收获、种植、浇水、除草、除虫、土地升级
- 好友：偷菜、帮忙、捣乱（按配置）
- 任务/邮件/礼包：自动检查与领取
- 背包与自动售卖（按配置）
- 好友黑名单与好友静默时段

### Web 面板
- 概览、农场、背包、好友、分析、账号、设置页面
- 实时状态与实时日志（Socket.io）
- 深色/浅色主题

---

## 3. 技术栈说明

### 后端（core）
- Node.js 20+
- Express 4
- Socket.io 4
- Axios
- protobufjs

### 前端（web）
- Vue 3 + TypeScript
- Vite 7
- Pinia
- Vue Router
- UnoCSS

### 构建与发布
- pnpm workspace
- Docker Compose
- pkg（二进制打包）

---

## 4. 前后端目录结构说明

```text
qq-farm-bot-ui/
├── core/
│   ├── client.js                  # 后端入口（主进程/worker 启动分流）
│   ├── src/
│   │   ├── config/                # 全局配置、路径与常量
│   │   ├── controllers/           # 管理端 API 与 Socket
│   │   │   ├── routes/            # auth/accounts/logs/qr 路由模块
│   │   │   └── socket.js          # Socket.io 初始化与订阅逻辑
│   │   ├── core/                  # worker 执行入口
│   │   ├── models/                # store（JSON 持久化）
│   │   ├── runtime/               # runtime-engine / worker-manager / data-provider
│   │   ├── services/              # 业务服务与通用服务
│   │   ├── proto/                 # protobuf 定义
│   │   └── gameConfig/            # 游戏配置与静态资源
│   └── data/                      # 运行期数据目录（默认）
├── web/
│   ├── src/
│   │   ├── api/                   # API 封装
│   │   ├── stores/                # Pinia 状态管理
│   │   ├── views/                 # 页面
│   │   ├── components/            # 组件
│   │   └── router/                # 路由与守卫
│   └── dist/                      # 前端构建产物（由后端托管）
├── docker-compose.yml
├── pnpm-workspace.yaml
└── package.json
```

---

## 5. 安装与依赖说明

### 运行要求
- Node.js 20+
- pnpm（建议 `corepack enable`）

### 安装依赖

```bash
corepack enable
pnpm install
```

---

## 6. 本地开发启动方式

> 推荐同时开两个终端：一个跑后端，一个跑前端。

### 方式 A：前后端分开启动（推荐）

终端 1（后端）：

```bash
pnpm dev:core
```

终端 2（前端）：

```bash
pnpm dev:web
```

前端开发服务器默认通过 Vite 代理转发 `/api`、`/socket.io`、`/game-config` 到 `http://localhost:3000`。

### 方式 B：仅启动后端（使用已构建前端）

```bash
pnpm build:web
pnpm dev:core
```

---

## 7. 前端运行方式

### 开发模式

```bash
pnpm dev:web
```

### 生产构建

```bash
pnpm build:web
```

构建输出目录：`web/dist`。

---

## 8. 后端运行方式

### 开发模式

```bash
pnpm dev:core
```

### 直接运行 core

```bash
pnpm -C core start
```

默认监听：`0.0.0.0:3000`。

---

## 9. 主要配置项 / 环境变量说明

> 以下为代码中可确认的主要环境变量。

| 变量名 | 作用 | 默认值 |
|---|---|---|
| `ADMIN_PASSWORD` | 管理员登录密码（首次部署必须设置） | 空 |
| `ADMIN_PORT` | 管理端 HTTP 端口 | `3000` |
| `ADMIN_TOKEN_TTL_HOURS` | 管理员 token 过期小时数 | `24` |
| `ADMIN_CORS_ORIGINS` | 允许的 CORS Origin（逗号分隔） | `http://localhost:3000,http://127.0.0.1:3000` |
| `ADMIN_SESSION_STORE` | 会话存储模式：`memory` / `file` | `memory` |
| `ACCOUNT_CODE_KEY` | 账号 code 加密主密钥（64位十六进制） | 空 |
| `ACCOUNT_CODE_KEYS` | 账号 code 解密密钥集合（逗号分隔） | 空 |
| `ACCOUNT_SECRET_ALLOW_LOCAL` | 允许本地密钥文件回退（`1` 启用） | 未启用 |
| `WEBHOOK_ALLOWED_HOSTS` | webhook 允许域名白名单（逗号分隔） | 空（不限制域名，但仍限制内网/回环） |
| `LOG_LEVEL` | 日志级别 | `info` |
| `FARM_RUNTIME_MODE` | worker 运行模式（`thread` / `fork`） | `thread`（自动降级条件见代码） |

内部变量（不建议手工设置）：`FARM_WORKER`、`FARM_ACCOUNT_ID`。

---

## 10. 数据存储方式说明

当前项目**正式持久化是文件存储**（非数据库）：

- `data/accounts.json`：账号列表
- `data/store.json`：全局配置、账号配置、主题、离线提醒、管理员密码哈希
- `data/account-secret.key`：本地加密密钥（仅在允许本地回退时创建）
- `data/admin-sessions.json`：仅在 `ADMIN_SESSION_STORE=file` 时使用

另外：`share.txt` 用于邀请码处理（文本文件）。

---

## 11. 接口与模块说明（简版）

### 认证相关
- `POST /api/login`
- `GET /api/auth/validate`
- `POST /api/admin/change-password`
- `POST /api/logout`

### 账号管理
- `GET /api/accounts`
- `POST /api/accounts`
- `DELETE /api/accounts/:id`
- `POST /api/accounts/:id/start`
- `POST /api/accounts/:id/stop`
- `POST /api/account/remark`
- `GET /api/account-logs`

### 运行状态与业务
- `GET /api/status`
- `POST /api/automation`
- `GET /api/lands`
- `GET /api/friends`
- `GET /api/friend/:gid/lands`
- `POST /api/friend/:gid/op`
- `GET /api/friend-blacklist`
- `POST /api/friend-blacklist/toggle`
- `GET /api/seeds`
- `GET /api/bag`
- `GET /api/daily-gifts`
- `POST /api/farm/operate`
- `GET /api/analytics`

### 设置与日志
- `GET /api/settings`
- `POST /api/settings/save`
- `POST /api/settings/theme`
- `POST /api/settings/offline-reminder`
- `POST /api/settings/offline-reminder/test`
- `GET /api/logs`
- `DELETE /api/logs`
- `GET /api/scheduler`

### QR 登录
- `POST /api/qr/create`
- `POST /api/qr/check`

### 实时通道
- Socket.io 路径：`/socket.io`

---

## 12. Docker 运行

```bash
docker compose up -d --build
```

默认映射：
- `3000:3000`
- `./data:/app/core/data`

停止：

```bash
docker compose down
```

---

## 13. 常见问题 / 注意事项

1. **登录提示管理员密码未初始化**
   - 原因：未设置 `ADMIN_PASSWORD`
   - 处理：设置环境变量后重启

2. **前端页面打开但 API 失败（开发模式）**
   - 原因：后端未启动或端口不一致
   - 处理：确认 `pnpm dev:core` 在 `3000` 运行，或调整代理/端口

3. **会话重启后失效**
   - 原因：默认 `ADMIN_SESSION_STORE=memory`
   - 如需持久化：设置 `ADMIN_SESSION_STORE=file`

4. **邀请码处理未生效**
   - 邀请码仅在微信平台逻辑中处理（`CONFIG.platform=wx`）

5. **二进制打包与原生依赖兼容性**
   - 当前构建链使用 `pkg`，若新增原生依赖（例如未来引入 SQLite 原生驱动），需额外验证打包兼容性（需人工确认）

---

## 14. 免责声明

本项目仅供学习与研究用途。由此产生的一切风险由使用者自行承担。
