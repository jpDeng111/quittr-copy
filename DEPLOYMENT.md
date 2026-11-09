# 在自己的 Mac 上运行 Quittr

程序、数据库和用户记录都运行/保存在你的电脑上；AI 对话与小课堂仍通过 `.env` 中配置的模型服务生成。电脑需要保持开机、联网且不休眠。

## 1. 本机与局域网

使用 Node.js 24.13+ 的 24.x 版本，无需安装数据库或 npm 依赖。保留现有 `.env` 的模型密钥，补充：

```dotenv
HOST=0.0.0.0
PORT=3000
PUBLIC_ORIGIN=
TRUST_PROXY=false
ALLOW_REGISTRATION=true
```

```bash
npm start
```

本机访问 `http://localhost:3000`。同一 Wi-Fi 下，用 Mac「系统设置 → 网络」中的局域网 IP 访问，例如 `http://192.168.1.10:3000`。允许 macOS 防火墙中的 Node 入站连接。若端口已被其他程序使用，设置 `PORT=3001` 后启动，并相应更改访问地址。

首页先显示注册/登录。注册使用邮箱作为账号标识，密码至少 12 位；本版本未配置 SMTP，不发送验证或找回密码邮件。私人数据只有登录后才能读取。局域网直连的 HTTP 入口适合可信网络测试，对外部署使用下方 HTTPS 配置。

`GET /healthz` 返回 `{"status":"ok"}`，可用于检查服务是否运行。默认数据目录为项目下的 `data`，也可将 `QUITTR_DATA_DIR` 设置为本机磁盘上的绝对路径。

## 2. 外网访问和 HTTPS

提供了 [Caddy 配置](ops/Caddyfile)。你需要自己的域名和可到达这台电脑的入口：域名的 DNS 指向公网地址，路由器将 TCP 80/443 转发给 Mac；如果网络处于运营商 NAT 后面，则需另行配置可信的 HTTPS 隧道入口。仅仅启动 Node 不会自动获得公网地址。

安装好 Caddy、设置 DNS 与转发后，将 `.env` 改为：

```dotenv
HOST=127.0.0.1
PORT=3000
PUBLIC_ORIGIN=https://quittr.example.com
TRUST_PROXY=true
ALLOW_REGISTRATION=true
```

重启 Node，然后在项目目录启动代理：

```bash
QUITTR_DOMAIN=quittr.example.com caddy run --config ops/Caddyfile
```

这里的域名需替换为你的实际域名。Caddy 负责 HTTPS 和流式回复转发，Node 只绑定本机回环地址。`PUBLIC_ORIGIN` 必须与用户访问的完整来源一致，不包含路径。启用 HTTPS 后，会话 Cookie 自动使用 Secure 和 `__Host-` 前缀。`TRUST_PROXY=true` 仅在请求来自本机回环地址时读取代理提供的访客 IP。

证书自动签发的条件见 [Caddy 官方说明](https://caddyserver.com/docs/automatic-https)。代理的启动、续期和联网条件也需要持续满足。本仓库不会自动修改路由器、防火墙、DNS 或你的域名账号。

## 3. Mac 登录后常驻与崩溃重启

先停止终端里手动启动的同端口服务，再生成适配当前 Node 路径和项目路径的 launchd 配置：

```bash
npm run service:config
plutil -lint data/com.quittr.server.plist
mkdir -p ~/Library/LaunchAgents
cp data/com.quittr.server.plist ~/Library/LaunchAgents/com.quittr.server.plist
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.quittr.server.plist
```

如设置了自定义 `QUITTR_DATA_DIR`，生成的 plist 位于该数据目录，调整上述路径。这个 LaunchAgent 会在该 macOS 用户登录后启动，异常退出时重启；它不是用户登录前的系统级守护进程。更新 Node 路径或移动项目后，重新生成并安装配置。

查看日志：`data/server.log`、`data/service.err.log`。重启：

```bash
launchctl kickstart -k gui/$(id -u)/com.quittr.server
```

停止并卸载常驻任务：

```bash
launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/com.quittr.server.plist
```

这是 Node 服务的常驻配置，Caddy 需单独保持运行。根据使用方式在系统设置中关闭自动休眠；笔记本合盖或电脑关机时，用户将无法访问。不要同时为同一数据库启动多个 Node 实例或 PM2 cluster；当前并发控制面向单进程、多用户。

## 4. 备份和恢复

```bash
npm run backup
```

使用 SQLite 在线备份 API，服务运行时也可执行，备份写入 `data/backups/`。备份包含账号、密码哈希、登录会话和用户记录，应放在只有管理员可读的位置。建议每天执行并复制到另一块受控磁盘；同一块硬盘中的备份不能应对硬盘损坏。

恢复时先停止 Node 和常驻任务，将当前 `quittr.sqlite`、`quittr.sqlite-wal`、`quittr.sqlite-shm` 整组移到另一个备份目录，再将选定备份复制为 `data/quittr.sqlite`，设置 `chmod 600 data/quittr.sqlite`，最后重启。恢复会回到备份时的状态；保留原文件以便回退。不要在服务运行时直接复制或替换 SQLite 主文件。

## 5. 账号管理和旧数据迁移

```bash
npm run admin -- users
npm run admin -- reset-password user@example.com
```

重置会生成随机临时密码并显示在本地终端，同时注销该用户全部会话。通过私下渠道交给用户，要求登录后到「我的账号」修改密码。命令参数里不需要放密码。

旧版 Demo 数据不会自动分配给第一个注册用户。需要迁移时，先注册一个新账号、退出并停止服务，备份数据库，再执行：

```bash
npm run admin -- import-legacy user@example.com /absolute/path/to/quittr-state.json
```

导入只允许目标账号尚无业务记录，不覆盖已有日记/聊天/进度；旧文件保留，旧版示例社区不导入。原 JSON 可能包含 Demo 的示例恢复记录，管理员应先检查是否需要保留。旧浏览器的 `sessionStorage` 聊天气泡不在 JSON 中，不能通过此命令恢复。

关闭新增注册：在 `.env` 设置 `ALLOW_REGISTRATION=false` 并重启；已有用户仍能登录。

## 6. 当前运行边界

- 数据保存在这台电脑，不依赖 Supabase 或云数据库。模型调用会向你配置的 AI 服务发送对话及用于课程生成的相关记录。
- 适用于单台机器上的小规模多用户服务。私人业务逻辑按账号排队，其他账号可并发；同一账号生成课程时，其后续请求可能需要等待。
- 聊天界面按页加载，但服务端个性化功能仍读取该账号的全部历史；大规模长期运营需进一步做历史窗口和数据库查询优化。
- 已提供账号权限、登录限流、来源校验、持久化、健康检查、备份工具。尚未包含邮件验证、自动邮件找回密码、社区审核后台、自动异地备份或高可用集群。
- 单账号每分钟最多 12 次聊天请求、每 10 分钟最多 6 次小课堂生成；其他写入每分钟上限 120 次。失败重试也计入限流。登录/注册按来源 IP 和账号另有限流，反向代理部署应正确设置真实 IP。
- Blocker 仍是网页内设置和演示逻辑，不能替代设备级的网站/应用拦截扩展。不能把网页设置保存成功视为已拦截用户设备。

## 验证

`npm test` 包含注册、密码哈希、Cookie、私有接口鉴权、账号隔离、并发写入、历史分页、消息重试去重、共享社区、重启恢复、密码修改注销和已有 AI 功能回归。HTTP 集成测试需要允许本机临时监听端口，测试使用临时数据库，不写正式用户数据。
