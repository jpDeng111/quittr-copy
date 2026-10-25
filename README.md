# Quittr Dashboard

这是一个本地运行的 Quittr 恢复进度 Dashboard 原型，用于展示戒断进度、打卡承诺、统计分析、资料库、个人页和 Melius 聊天界面。

## 技术栈

- 前端：原生 HTML/CSS/JS + React 18 UMD
- 后端：原生 Node.js `http` 服务
- 数据存储：本地 JSON 文件

## 本地启动

### 1. 启动服务

```bash
npm start
```

### 2. 打开页面

```text
http://localhost:3000
```

项目没有 npm 运行时依赖，使用 `npm start` 启动，`npm test` 运行测试。

### AI 聊天配置

在项目根目录的 `.env` 中配置 `DASHSCOPE_API_KEY`、`DASHSCOPE_BASE_URL` 和 `MELIUS_MODEL`，字段示例见 `.env.example`。当前使用阿里云 Coding Plan 的 OpenAI 兼容接口与 `qwen3.7-plus` 模型。更改配置后需重启服务。

密钥仅由 Node.js 服务端读取；前端通过 `/api/melius/chat` 发起聊天请求，不接触密钥。`.env` 已被 Git 忽略。

Melius 可调用应用内小游戏，并把用户明确表达的日记、动力、未破戒打卡及破戒复盘保存到本地数据。每次归档会显示结果卡片，可直接查看日记、动力或统计。破戒只有在用户明确说明已经发生时才记录；假设、担心、差点破戒不应重置统计。

聊天消息保留在当前浏览器会话中，离开小游戏后可以继续原对话。未收到回复的消息可重新发送；消息ID和已执行操作会持久化，超时或刷新后重试不会重复记录。同一消息处理中点击“停止等待”只停止前端等待，已经执行的记录会在重试时取回。

麦克风按钮使用浏览器的 SpeechRecognition 接口，点击后才启动语音识别，识别结果先填入输入框供编辑，不会自动发送。可用性取决于浏览器、麦克风权限及语音识别网络服务；不支持时可使用系统听写或键盘输入。

测试：`npm test`。设置 `QUITTR_DATA_DIR` 可使用独立的数据目录验证，避免把测试事件写入实际记录。

## 当前功能

- 首页恢复进度、里程碑、快捷操作和功能卡片
- Pledge 弹窗与完成动画
- Analytics 页面，展示当前 streak、历史 reset、趋势图和统计指标
- Reset 按钮会写入一次 relapse 记录，并刷新统计数据
- Library 页面，包含声音场景、课程、游戏和排行榜原型
- Profile 页面，展示徽章、成就和帖子原型
- Melius 聊天页：多轮对话、小游戏调用、日记与动力归档、语音输入及失败重试
- 底部导航，可在 Home、Chat、Stats、Library 和 Profile 之间切换

## API

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/` | Quittr Dashboard 页面 |
| `GET` | `/api/quittr/analytics` | 获取恢复统计数据 |
| `POST` | `/api/quittr/relapses` | 记录一次 relapse/reset 并返回新统计 |
| `POST` | `/api/melius/chat` | 对话、应用工具调用及按消息ID去重的重试 |

## 本地数据

```text
.
├── data/
│   └── quittr-state.json
├── public/
│   ├── app.js
│   ├── index.html
│   └── styles.css
├── server.js
└── package.json
```

- `data/quittr-state.json` 保存 Quittr 的开始时间和 relapse 记录。
- 如果数据文件不存在，服务端会自动创建一份默认状态。
- Melius 聊天消息保存在当前浏览器会话中，刷新或返回游戏后可继续。结构化归档和已执行操作另存于本地 JSON 文件。

## 注意事项

- 推荐使用 Node.js 18 或更高版本。
- 页面通过 CDN 加载 React 18，浏览器需要能访问 `unpkg.com`。
- `npm test` 包含工具调用、记录去重、破戒识别边界、重发和语音转文字逻辑的回归测试。

## License

License information has not been specified yet.
