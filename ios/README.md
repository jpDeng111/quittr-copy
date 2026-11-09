# Quittr iOS

SwiftUI + WKWebView 客户端，连接这台 Mac 已运行的 Quittr 服务，复用相同登录、日记、完整聊天、课程和游戏进度。iOS 16.4+，无第三方 SDK、CocoaPods 或 npm 依赖。

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

当前开发环境只有 Xcode Command Line Tools，没有完整 Xcode / iOS SDK，因此已验证 Swift 语法、项目文件和 plist 格式，以及网页手机尺寸下的实际交互；**没有完成 iOS 模拟器编译、签名或真机测试**。可在安装 Xcode 后运行：

```bash
xcodebuild -project ios/Quittr.xcodeproj -scheme Quittr -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build
```

当前工程是自托管服务的 iOS 容器客户端，尚未提交 App Store。后续上架需要实际设备验证、正式 HTTPS 服务、隐私政策和与实际数据处理一致的 App Privacy 信息；苹果是否接受取决于最终产品和审核。

仓库提供 `ops/github-actions.yml` 自动测试/模拟器构建模板。当前用于上传的 OAuth 凭据没有 `workflow` scope，GitHub 拒绝直接创建工作流，所以模板尚未启用。具备工作流管理权限后，将其放到 `.github/workflows/ci.yml` 即可触发；在此之前不能把上传代码视为 iOS 编译通过。

安全区实现参考 [WebKit 文档](https://webkit.org/blog/7929/designing-websites-for-iphone-x/)，客户端使用 [WKWebView](https://developer.apple.com/documentation/webkit/wkwebview)。
