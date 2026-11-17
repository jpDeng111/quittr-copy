import Foundation
import WebKit
import EventKit
import UIKit
import CryptoKit

private struct PlannerTask: Decodable {
    let id: String
    let title: String
    let detail: String
    let scheduledAt: String
    let durationMinutes: Int
    let progress: Int
    var date: Date? {
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return fractional.date(from: scheduledAt) ?? ISO8601DateFormatter().date(from: scheduledAt)
    }
}
private struct PlannerPlan: Decodable {
    let id: String
    let title: String
    let goal: String
    let timeZone: String
    let tasks: [PlannerTask]
}
private struct PlannerRequest: Decodable {
    let action: String
    let accountId: String
    let plan: PlannerPlan
}
private struct PlannerFailure: LocalizedError {
    let message: String
    var errorDescription: String? { message }
}

// WithReply returns an actual promise to JavaScript; a saved record is never
// acknowledged until EventKit commits it. Only the configured main origin may call.
final class PlannerBridge: NSObject, WKScriptMessageHandlerWithReply {
    weak var owner: QuittrWebModel?
    private let store = EKEventStore()
    private var busy = false
    init(_ owner: QuittrWebModel) { self.owner = owner }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage, replyHandler: @escaping (Any?, String?) -> Void) {
        guard let owner, message.frameInfo.isMainFrame,
              let frameURL = message.frameInfo.request.url, owner.isTrustedOrigin(frameURL),
              let pageURL = owner.webView.url, owner.isTrustedOrigin(pageURL) else {
            replyHandler(nil, "只能从已连接的 Quittr 页面操作。"); return
        }
        guard !busy else { replyHandler(nil, "另一个同步操作尚未结束。"); return }
        do {
            let data = try JSONSerialization.data(withJSONObject: message.body)
            guard data.count < 200_000 else { throw PlannerFailure(message: "计划内容过长。") }
            let request = try JSONDecoder().decode(PlannerRequest.self, from: data)
            try validate(request)
            let origin = owner.server!
            busy = true
            Task { @MainActor [weak self] in
                guard let self else { replyHandler(nil, "页面已关闭。"); return }
                defer { self.busy = false }
                do {
                    let result = try await self.handle(request, origin: origin)
                    guard self.owner?.server == origin else { replyHandler(nil, "服务器已切换，请重新同步。"); return }
                    replyHandler(result, nil)
                } catch { replyHandler(["error": error.localizedDescription], nil) }
            }
        } catch { replyHandler(["error": "计划数据无效，请刷新页面后重试。"], nil) }
    }

    private func validate(_ request: PlannerRequest) throws {
        let identifier: (String) -> Bool = { $0.count <= 128 && $0.range(of: "^[A-Za-z0-9_-]+$", options: .regularExpression) != nil }
        guard ["reminders", "calendar", "notes", "progress", "readProgress"].contains(request.action),
              identifier(request.accountId), identifier(request.plan.id), request.plan.title.count <= 80,
              request.plan.goal.count <= 300, request.plan.tasks.count <= 180,
              TimeZone(identifier: request.plan.timeZone) != nil,
              Set(request.plan.tasks.map(\.id)).count == request.plan.tasks.count,
              request.plan.tasks.allSatisfy({ identifier($0.id) && $0.id.hasPrefix(request.plan.id + "-") && !$0.title.isEmpty && $0.title.count <= 80 && $0.detail.count <= 500 && $0.date != nil && (5...180).contains($0.durationMinutes) && (0...100).contains($0.progress) }) else {
            throw PlannerFailure(message: "计划内容或时间无效。")
        }
    }
    private func namespace(_ request: PlannerRequest, origin: URL) -> String {
        let hash = SHA256.hash(data: Data((origin.absoluteString + "|" + request.accountId).utf8))
        return "quittr-planner-v1-" + hash.map { String(format: "%02x", $0) }.joined()
    }
    private func mapping(_ key: String) -> [String: String] { UserDefaults.standard.dictionary(forKey: key) as? [String: String] ?? [:] }
    private func marker(_ request: PlannerRequest, task: PlannerTask, origin: URL) -> URL? {
        var url = URLComponents(url: origin, resolvingAgainstBaseURL: false)
        url?.fragment = "plan=\(request.plan.id)&task=\(task.id)"
        return url?.url
    }
    @MainActor private func authorize(_ entity: EKEntityType) async throws {
        let granted: Bool
        if #available(iOS 17.0, *) {
            granted = entity == .reminder ? try await store.requestFullAccessToReminders() : try await store.requestFullAccessToEvents()
        } else { granted = try await store.requestAccess(to: entity) }
        guard granted else { throw PlannerFailure(message: entity == .reminder ? "请在 iOS 设置中允许 Quittr 访问提醒事项，再点击同步。" : "请在 iOS 设置中允许 Quittr 访问日历，再点击同步。") }
    }
    private func canReadReminders() -> Bool {
        let status = EKEventStore.authorizationStatus(for: .reminder)
        if #available(iOS 17.0, *) { return status == .fullAccess }
        return status == .authorized
    }
    private func notes(_ request: PlannerRequest, task: PlannerTask) -> String {
        "\(request.plan.title)\n\(task.detail)\n完成程度：\(task.progress)%\n由 Melius 计划创建"
    }
    @MainActor private func handle(_ request: PlannerRequest, origin: URL) async throws -> [String: Any] {
        let prefix = namespace(request, origin: origin)
        if request.action == "notes" { return try await shareNote(request) }
        if request.action == "readProgress" {
            guard canReadReminders() else { throw PlannerFailure(message: "请先将计划同步到提醒事项并允许访问。") }
            let ids = mapping(prefix + "-reminders")
            let completed = request.plan.tasks.compactMap { task -> String? in
                guard let id = ids[task.id], let item = store.calendarItem(withIdentifier: id) as? EKReminder,
                      item.url == marker(request, task: task, origin: origin), item.isCompleted else { return nil }
                return task.id
            }
            return ["completedIds": completed]
        }
        if request.action == "progress" {
            // Editing app progress must never trigger a new OS permission prompt.
            guard canReadReminders() else { return ["count": 0] }
            let ids = mapping(prefix + "-reminders")
            var count = 0
            for task in request.plan.tasks {
                guard let id = ids[task.id], let item = store.calendarItem(withIdentifier: id) as? EKReminder,
                      item.url == marker(request, task: task, origin: origin) else { continue }
                item.isCompleted = task.progress == 100
                item.notes = notes(request, task: task)
                try store.save(item, commit: true); count += 1
            }
            return ["count": count]
        }
        let reminders = request.action == "reminders"
        try await authorize(reminders ? .reminder : .event)
        guard owner?.server == origin else { throw PlannerFailure(message: "服务器已切换，已停止同步。") }
        let key = prefix + (reminders ? "-reminders" : "-calendar")
        var ids = mapping(key), count = 0
        let calendar: EKCalendar
        if reminders {
            guard let available = store.defaultCalendarForNewReminders() ?? store.calendars(for: .reminder).first(where: { $0.allowsContentModifications }) else { throw PlannerFailure(message: "未找到可写的提醒事项列表，请先在系统提醒事项中创建一个列表。") }
            calendar = available
        } else {
            guard let available = store.defaultCalendarForNewEvents ?? store.calendars(for: .event).first(where: { $0.allowsContentModifications }) else { throw PlannerFailure(message: "未找到可写的日历，请先在系统日历中设置默认日历。") }
            calendar = available
        }
        do {
            for task in request.plan.tasks {
                guard let date = task.date else { continue }
                if reminders {
                    let previous = ids[task.id].flatMap { store.calendarItem(withIdentifier: $0) as? EKReminder }
                    let owned = previous?.url == marker(request, task: task, origin: origin)
                    let item = owned ? previous! : EKReminder(eventStore: store)
                    if !owned { item.calendar = calendar }
                    item.title = task.title; item.notes = notes(request, task: task)
                    item.url = marker(request, task: task, origin: origin)
                    item.timeZone = TimeZone(identifier: request.plan.timeZone)
                    var cal = Calendar(identifier: .gregorian)
                    cal.timeZone = TimeZone(identifier: request.plan.timeZone)!
                    var components = cal.dateComponents([.year, .month, .day, .hour, .minute], from: date)
                    components.timeZone = cal.timeZone
                    item.dueDateComponents = components
                    item.alarms = [EKAlarm(absoluteDate: date)]
                    // Resyncing must preserve a completion made in the Reminders app.
                    if task.progress == 100 { item.isCompleted = true }
                    try store.save(item, commit: true)
                    ids[task.id] = item.calendarItemIdentifier
                } else {
                    let previous = ids[task.id].flatMap { store.event(withIdentifier: $0) }
                    let owned = previous?.url == marker(request, task: task, origin: origin)
                    let item = owned ? previous! : EKEvent(eventStore: store)
                    if !owned { item.calendar = calendar }
                    item.title = task.title; item.notes = notes(request, task: task)
                    item.url = marker(request, task: task, origin: origin)
                    item.timeZone = TimeZone(identifier: request.plan.timeZone)
                    item.startDate = date; item.endDate = date.addingTimeInterval(Double(task.durationMinutes * 60))
                    item.alarms = [EKAlarm(relativeOffset: 0)]
                    try store.save(item, span: .thisEvent, commit: true)
                    ids[task.id] = item.eventIdentifier
                }
                // Persist each identifier immediately so partial failures can be retried.
                UserDefaults.standard.set(ids, forKey: key); count += 1
            }
        } catch { throw PlannerFailure(message: "已同步 \(count) 项，后续项目暂未完成。请重试，已保存的项目会被更新。") }
        return ["count": count]
    }
    @MainActor private func shareNote(_ request: PlannerRequest) async throws -> [String: Any] {
        guard let root = owner?.webView.window?.rootViewController else { throw PlannerFailure(message: "分享面板暂时无法打开。") }
        var presenter = root
        while let presented = presenter.presentedViewController { presenter = presented }
        guard !presenter.isBeingDismissed else { throw PlannerFailure(message: "请关闭当前面板后重试。") }
        let formatter = DateFormatter(); formatter.locale = Locale(identifier: "zh_CN")
        formatter.timeZone = TimeZone(identifier: request.plan.timeZone); formatter.dateFormat = "M月d日 HH:mm"
        let text = ([request.plan.title, request.plan.goal, "时区：\(request.plan.timeZone)", ""] + request.plan.tasks.map { task in
            "\(task.progress == 100 ? "☑" : "☐") \(formatter.string(from: task.date!)) \(task.title) · \(task.durationMinutes)分钟 · \(task.progress)%\n\(task.detail)"
        }).joined(separator: "\n")
        return await withCheckedContinuation { continuation in
            let sheet = UIActivityViewController(activityItems: [text], applicationActivities: nil)
            sheet.popoverPresentationController?.sourceView = owner?.webView
            sheet.popoverPresentationController?.sourceRect = CGRect(x: 20, y: 20, width: 1, height: 1)
            sheet.completionWithItemsHandler = { activity, completed, _, error in
                if let error { continuation.resume(returning: ["error": error.localizedDescription]) }
                else { continuation.resume(returning: ["shared": completed, "notes": activity?.rawValue.contains("mobilenotes") == true]) }
            }
            presenter.present(sheet, animated: true)
        }
    }
}
