import SwiftUI
import WebKit
import UIKit

struct SharedFile: Identifiable { let id = UUID(); let url: URL }

final class WeakBridge: NSObject, WKScriptMessageHandler {
    weak var owner: QuittrWebModel?
    init(_ owner: QuittrWebModel) { self.owner = owner }
    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame, message.body as? String == "settings" else { return }
        owner?.showSettings = true
    }
}

final class QuittrWebModel: NSObject, ObservableObject, WKNavigationDelegate, WKUIDelegate, WKDownloadDelegate {
    @Published var server: URL?
    @Published var error: String?
    @Published var loading = false
    @Published var showSettings = false
    @Published var sharedFile: SharedFile?
    let webView: WKWebView
    private var downloads: [ObjectIdentifier: URL] = [:]
    private var lastSharedURL: URL?

    override init() {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()
        config.allowsInlineMediaPlayback = true
        config.applicationNameForUserAgent = "Quittr-iOS/1.0"
        webView = WKWebView(frame: .zero, configuration: config)
        super.init()
        webView.configuration.userContentController.add(WeakBridge(self), name: "quittrNative")
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.isOpaque = false
        webView.backgroundColor = UIColor(red: 247/255, green: 246/255, blue: 241/255, alpha: 1)
        webView.scrollView.backgroundColor = webView.backgroundColor
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.allowsBackForwardNavigationGestures = true
        if let saved = UserDefaults.standard.string(forKey: "serverOrigin"), let url = try? Self.validatedOrigin(saved) {
            server = url; reload()
        }
    }

    static func validatedOrigin(_ value: String) throws -> URL {
        struct Invalid: LocalizedError { var errorDescription: String? { "请输入有效的服务器根地址，例如 https://quittr.example.com。正式版本必须使用 HTTPS。" } }
        guard var parts = URLComponents(string: value.trimmingCharacters(in: .whitespacesAndNewlines)),
              let scheme = parts.scheme?.lowercased(), let host = parts.host?.lowercased(), !host.isEmpty,
              parts.user == nil, parts.password == nil, parts.query == nil, parts.fragment == nil,
              parts.path.isEmpty || parts.path == "/" else { throw Invalid() }
        var allowed = scheme == "https"
        #if DEBUG
        let pieces = host.split(separator: ".", omittingEmptySubsequences: false)
        let segments = pieces.compactMap { Int($0) }
        let privateIP = pieces.count == 4 && segments.count == 4 && segments.allSatisfy { (0...255).contains($0) } &&
            (segments[0] == 10 || segments[0] == 127 || (segments[0] == 192 && segments[1] == 168) || (segments[0] == 172 && (16...31).contains(segments[1])))
        allowed = allowed || (scheme == "http" && (privateIP || host == "localhost" || host == "::1" || host.hasSuffix(".local")))
        #endif
        guard allowed else { throw Invalid() }
        parts.path = "/"
        guard let url = parts.url else { throw Invalid() }
        return url
    }

    func configure(_ url: URL, completion: @escaping () -> Void) {
        if server == url { reload(); completion(); return }
        // A fresh installation has no previous server session to clear. Avoid
        // waiting for WebKit's data processes before the first page is loaded.
        if server == nil {
            server = url
            UserDefaults.standard.set(url.absoluteString, forKey: "serverOrigin")
            reload(); completion(); return
        }
        webView.stopLoading()
        webView.configuration.websiteDataStore.removeData(ofTypes: WKWebsiteDataStore.allWebsiteDataTypes(), modifiedSince: .distantPast) { [weak self] in
            DispatchQueue.main.async {
                guard let self else { return }
                self.server = url
                UserDefaults.standard.set(url.absoluteString, forKey: "serverOrigin")
                self.reload(); completion()
            }
        }
    }
    func reload() {
        guard let server else { return }
        error = nil; loading = true
        webView.load(URLRequest(url: server, cachePolicy: .reloadIgnoringLocalCacheData))
    }
    private func sameOrigin(_ url: URL) -> Bool {
        guard let server else { return false }
        let port: (URL) -> Int = { $0.port ?? ($0.scheme == "https" ? 443 : 80) }
        return url.scheme == server.scheme && url.host == server.host && port(url) == port(server)
    }
    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = action.request.url else { decisionHandler(.cancel); return }
        if sameOrigin(url) {
            if action.shouldPerformDownload { decisionHandler(.download) }
            else if action.targetFrame == nil { webView.load(action.request); decisionHandler(.cancel) }
            else { decisionHandler(.allow) }
        } else {
            // Links leave the embedded account context; no private cookies are copied.
            if action.navigationType == .linkActivated && url.scheme == "https" { UIApplication.shared.open(url) }
            decisionHandler(.cancel)
        }
    }
    func webView(_ webView: WKWebView, decidePolicyFor response: WKNavigationResponse, decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
        let attachment = (response.response as? HTTPURLResponse)?.value(forHTTPHeaderField: "Content-Disposition")?.lowercased().contains("attachment") == true
        decisionHandler(attachment || !response.canShowMIMEType ? .download : .allow)
    }
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) { loading = false; error = nil }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { failed(error) }
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { failed(error) }
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { reload() }
    private func failed(_ failure: Error) {
        if (failure as NSError).code == NSURLErrorCancelled { return }
        loading = false
        error = "请检查服务器地址、电脑是否开机，以及 iPhone 的网络和本地网络权限。"
    }
    func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) { download.delegate = self }
    func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) { download.delegate = self }
    func download(_ download: WKDownload, decideDestinationUsing response: URLResponse, suggestedFilename: String, completionHandler: @escaping (URL?) -> Void) {
        guard let url = response.url, sameOrigin(url) else { completionHandler(nil); return }
        let destination = FileManager.default.temporaryDirectory.appendingPathComponent("\(UUID().uuidString)-quittr-data.json")
        downloads[ObjectIdentifier(download)] = destination
        completionHandler(destination)
    }
    func downloadDidFinish(_ download: WKDownload) {
        if let url = downloads.removeValue(forKey: ObjectIdentifier(download)) { lastSharedURL = url; sharedFile = SharedFile(url: url) }
    }
    func clearSharedFile() {
        if let url = lastSharedURL { try? FileManager.default.removeItem(at: url) }
        lastSharedURL = nil
    }
    func download(_ download: WKDownload, didFailWithError error: Error, resumeData: Data?) {
        if let url = downloads.removeValue(forKey: ObjectIdentifier(download)) { try? FileManager.default.removeItem(at: url) }
        loading = false; self.error = "导出未完成，请检查连接后重试。"
    }
}

struct QuittrWebView: UIViewRepresentable {
    @ObservedObject var model: QuittrWebModel
    func makeUIView(context: Context) -> WKWebView { model.webView }
    func updateUIView(_ view: WKWebView, context: Context) {}
}
