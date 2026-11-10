# 轻甜 iOS

显示名为轻甜的 SwiftUI + WKWebView 客户端，连接这台 Mac 已运行的 轻甜服务，复用相同登录、饮食小记、渴望、日记、完整聊天与减糖小课。iOS 16.4+，无第三方 SDK、CocoaPods 或 npm 依赖。

## 安装到 iPhone

1. 在安装完整 Xcode 的 Mac 中打开 `ios/Quittr.xcodeproj`，选择 `Quittr` scheme。
2. 在 Signing & Capabilities 中选择自己的 Development Team，并将 Bundle Identifier 改为自己的唯一标识。
3. 连接 iPhone，开启设备开发者模式，选择真机运行 Debug 配置。
4. 首次启动填写服务器地址。同一 Wi-Fi 可填 `http://电脑的局域网IP:3000`；iPhone 上的 `localhost` 指向手机本身。允许「本地网络」权限。
5. 在页面中注册/登录，所有个人记录都保存在服务器上。手机与 Mac 必须能够互相访问。

服务器地址可在登录页或「我的账号 → 服务器连接设置」修改。切换服务器会清除这个 App 中的原登录和网页缓存，服务器端数据保留。

## 网络和数据

- 使用 WebKit 的持久化 Cookie 数据库；不把密码或会话 Token 复制到 UserDefaults。UserDefaults 只保存服务器根地址。
- Debug 仅接受 HTTPS 或本机/私有局域网的 HTTP 地址；Debug 专用 Info.plist 为 WKWebView 提供 HTTP 调试权限。Release 仅接受 HTTPS，且没有任意网络加载例外。
- 导航留在配置的服务器同一来源内，HTTPS 外链在系统浏览器打开。
- 「导出我的数据」使用 WKDownload 和系统分享面板，可保存到「文件」。分享面板关闭后清除本次导出的临时文件。
- 首次局域网连接显示系统权限说明，不会忽略或绕过证书错误。
- 语音输入可使用 iOS 系统键盘听写；网页 SpeechRecognition 在 WKWebView 中的可用性以系统支持为准。

## 主屏幕网页版

也可直接在 Safari 打开服务器，使用「分享 → 添加到主屏幕」。网页已包含应用图标、manifest、安全区和键盘适配。HTTP 局域网能在线使用；Service Worker 和离线提示需要 HTTPS（或浏览器认可的 localhost 安全上下文）。离线时不缓存私人 API 数据、不排队提交日记或消息。

## 验证边界

2026-11-10 已使用 **Xcode 16.3 / iOS 18.4 SDK** 成功编译 Debug 版本，安装并启动于 **iPhone 16 / iOS 18.4 模拟器**。已通过界面确认连接 `http://localhost:3000` 后显示轻甜登录页；没有替用户注册或登录正式账号。尚未完成开发者签名、真机测试、登录后的全部原生交互或 App Store 发布。

系统 `xcode-select -p` 仍可能指向 Command Line Tools；本次仅在构建命令中指定完整 Xcode，不修改全局路径：

```bash
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer xcodebuild -project ios/Quittr.xcodeproj -scheme Quittr -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' -derivedDataPath ios/DerivedData CODE_SIGNING_ALLOWED=NO build
```

也可在 Xcode 中打开工程，选择 `Quittr` scheme 和已安装的 iPhone 模拟器后运行。**模拟器**可以用 `http://localhost:3000` 连接这台 Mac，因此 Debug 模拟器首次设置会预填该地址；**真机**仍需填写电脑的局域网地址或 HTTPS 域名。首次连接跳过无历史会话的数据清理，切换已有服务器时仍清理原登录与缓存，防止混用账号。

当前工程是自托管服务的 iOS 容器客户端，尚未提交 App Store。后续上架需要实际设备验证、正式 HTTPS 服务、隐私政策和与实际数据处理一致的 App Privacy 信息；苹果是否接受取决于最终产品和审核。

仓库提供 `ops/github-actions.yml` 自动测试/模拟器构建模板。当前用于上传的 OAuth 凭据没有 `workflow` scope，GitHub 拒绝直接创建工作流，所以模板尚未启用。具备工作流管理权限后，将其放到 `.github/workflows/ci.yml` 即可触发；以上本机模拟器构建成功不代表 GitHub CI 已运行。

安全区实现参考 [WebKit 文档](https://webkit.org/blog/7929/designing-websites-for-iphone-x/)，客户端使用 [WKWebView](https://developer.apple.com/documentation/webkit/wkwebview)。

工程名 `Quittr.xcodeproj`、scheme 与 bundle 标识暂时保留以兼容前一版本；应用显示名、浅色界面、图标和业务页面均已切换为轻甜。新旧记录的隔离策略及原因见根目录 README。
