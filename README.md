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

## Melius 每日小课堂

首页和 Library 会主动展示当天的小课堂，Learn 中可切换「为你推荐」与原有系统课程。应用按浏览器时区选取前一个自然日的 Melius 对话、日记、冲动、恢复打卡和小课反馈，调用现有服务端模型生成五张中文卡片：理解、过程图、练习、自我觉察、今日行动。

课程每天首次打开时自动准备，生成成功后按日期和时区保存，重复访问不会重复调用模型。首页「重新生成」或阅读页「换一节」会明确发起新的 AI 请求，并更新整套卡片；原课程及完成记录仍保留在历史中。生成失败时保留原课程并提示重试。支持翻页、滑动、方向键、一分钟练习、选择感受和行动、阅读位置恢复，以及已生成课程的历史回看。完成后的课程与选择保存在本地 JSON 中。页面打开期间跨日也会更新当天推荐。这里的推送是应用内推荐，不发送系统通知。

没有昨日记录时明确提供入门内容；模型失败时保留标为「精选小课」的内容并允许重试，不将固定内容伪装为 AI 生成。新增 Melius 消息会在服务端保存用户原文，用于次日课程；升级前未保存原文的对话仍可通过已归档的日记等记录提供依据。原文仅保存在本地，并通过已配置的模型接口用于课程生成，不返回给课程展示页。

新增接口：`GET /api/lessons/daily?timeZone=Asia%2FShanghai` 获取今日课程及历史；`POST /api/lessons/daily` 生成并缓存课程；`POST /api/lessons/complete` 保存完成记录与选择。测试使用独立内存状态，不修改实际恢复记录。

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
