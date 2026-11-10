import SwiftUI
import UIKit

@main
struct QuittrApp: App {
    @StateObject private var model = QuittrWebModel()

    var body: some Scene {
        WindowGroup {
            ZStack {
                Color(red: 247/255, green: 246/255, blue: 241/255).ignoresSafeArea()
                if model.server == nil {
                    ServerSettings(model: model, firstLaunch: true)
                } else {
                    QuittrWebView(model: model).ignoresSafeArea()
                    if model.loading { VStack { ProgressView().tint(.mint); Spacer() }.padding(.top, 12) }
                    if let error = model.error {
                        VStack(spacing: 20) {
                            Image(systemName: "wifi.exclamationmark").font(.largeTitle)
                            Text("暂时无法连接").font(.title2.bold())
                            Text(error).font(.subheadline).foregroundStyle(.secondary).multilineTextAlignment(.center)
                            Button("重新连接") { model.reload() }.buttonStyle(.borderedProminent).tint(.mint)
                            Button("服务器设置") { model.showSettings = true }
                        }.padding(32).frame(maxWidth: 360).background(.ultraThickMaterial, in: RoundedRectangle(cornerRadius: 24))
                    }
                }
            }
            .preferredColorScheme(.light)
            .sheet(isPresented: $model.showSettings) { ServerSettings(model: model, firstLaunch: false) }
            .sheet(item: $model.sharedFile, onDismiss: { model.clearSharedFile() }) { file in ShareSheet(url: file.url) }
            .onOpenURL { _ in /* Server login stays inside the configured origin. */ }
        }
    }
}

struct ServerSettings: View {
    @ObservedObject var model: QuittrWebModel
    let firstLaunch: Bool
    @Environment(\.dismiss) private var dismiss
    @State private var address = ""
    @State private var error: String?
    @State private var saving = false

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    VStack(alignment: .leading, spacing: 14) {
                        Text("◒ 轻甜").font(.title2.bold()).foregroundStyle(.mint)
                        Text("连接你的减糖空间").font(.title.bold())
                        Text("输入运行轻甜的服务器地址。登录后即可继续使用同一账号的日记、会话和进度。")
                            .font(.subheadline).foregroundStyle(.secondary)
                    }.padding(.vertical, 14)
                }
                Section("服务器地址") {
                    TextField("https://quittr.example.com", text: $address)
                        .keyboardType(.URL).textInputAutocapitalization(.never).autocorrectionDisabled()
                        .accessibilityLabel("服务器地址")
                    #if DEBUG
                    #if targetEnvironment(simulator)
                    Text("模拟器可填 http://localhost:3000，连接这台 Mac 上的轻甜服务。")
                        .font(.footnote).foregroundStyle(.secondary)
                    #else
                    Text("局域网调试可填 http://电脑的局域网IP:3000。iPhone 与电脑需要处于同一网络；不要填写 localhost。")
                        .font(.footnote).foregroundStyle(.secondary)
                    #endif
                    #else
                    Text("正式版本使用 HTTPS 地址。").font(.footnote).foregroundStyle(.secondary)
                    #endif
                }
                if !firstLaunch {
                    Section { Text("切换服务器会清除这台 iPhone 中原服务器的登录状态。服务器上的记录会保留。")
                        .font(.footnote).foregroundStyle(.secondary) }
                }
                if let error { Section { Text(error).foregroundStyle(.red) } }
                Section {
                    Button(saving ? "正在连接…" : "保存并连接") {
                        guard !saving else { return }
                        do {
                            let url = try QuittrWebModel.validatedOrigin(address)
                            saving = true; error = nil
                            model.configure(url) { saving = false; if !firstLaunch { dismiss() } }
                        } catch { self.error = error.localizedDescription }
                    }.disabled(saving).frame(maxWidth: .infinity, minHeight: 32)
                }
            }
            .navigationTitle(firstLaunch ? "欢迎使用轻甜" : "服务器设置")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { if !firstLaunch { ToolbarItem(placement: .cancellationAction) { Button("取消") { dismiss() } } } }
            .onAppear {
                #if DEBUG && targetEnvironment(simulator)
                address = model.server?.absoluteString ?? "http://localhost:3000"
                #else
                address = model.server?.absoluteString ?? ""
                #endif
            }
        }.preferredColorScheme(.light)
    }
}

struct ShareSheet: UIViewControllerRepresentable {
    let url: URL
    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: [url], applicationActivities: nil)
    }
    func updateUIViewController(_ controller: UIActivityViewController, context: Context) {}
}
