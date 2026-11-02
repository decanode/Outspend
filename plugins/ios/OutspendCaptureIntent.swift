import AppIntents
import Foundation
import UserNotifications

// "Add transaction to Outspend": a Shortcuts action that takes a bank message and queues it for the app.
// It runs in the background without opening the app (openAppWhenRun = false). The message is appended to
// pending-captures.jsonl in the shared App Group container (group.com.decanode.outspend); the app reads
// and clears that file whenever it is opened or resumes (src/services/PendingCaptures.js).
// Nothing leaves the device.

@available(iOS 16.0, *)
struct AddTransactionIntent: AppIntent {
  static var title: LocalizedStringResource = "Add transaction to Outspend"
  static var description = IntentDescription("Saves a bank message to Outspend without opening the app.")
  static var openAppWhenRun: Bool = false

  @Parameter(title: "Message", description: "The bank SMS text")
  var message: String

  static var parameterSummary: some ParameterSummary {
    Summary("Add \(\.$message) to Outspend")
  }

  func perform() async throws -> some IntentResult {
    let text = message.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !text.isEmpty, text.count <= 2000 else { return .result() }

    let entry: [String: Any] = ["text": text, "at": Int(Date().timeIntervalSince1970 * 1000)]
    guard let data = try? JSONSerialization.data(withJSONObject: entry),
          var line = String(data: data, encoding: .utf8) else { return .result() }
    line += "\n"

    // Use shared App Group container so both this background intent and the main app see the same file.
    // Fall back to the document directory if App Groups are not yet active in development.
    let sharedDir = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: "group.com.decanode.outspend")
      ?? FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]

    let file = sharedDir.appendingPathComponent("pending-captures.jsonl")

    // Create file with completeUntilFirstUserAuthentication so writes succeed even when the device is locked.
    if !FileManager.default.fileExists(atPath: file.path) {
      FileManager.default.createFile(
        atPath: file.path,
        contents: nil,
        attributes: [FileAttributeKey.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication]
      )
    }

    if let handle = try? FileHandle(forWritingTo: file), let bytes = line.data(using: .utf8) {
      defer { try? handle.close() }
      _ = try? handle.seekToEnd()
      try? handle.write(contentsOf: bytes)
    }

    // Schedule a subtle notification confirmation so the user knows the background capture worked.
    let content = UNMutableNotificationContent()
    content.title = "Outspend"
    content.body = "Bank transaction captured silently"
    content.sound = .default
    let request = UNNotificationRequest(identifier: UUID().uuidString, content: content, trigger: nil)
    UNUserNotificationCenter.current().add(request, withCompletionHandler: nil)

    return .result()
  }
}

@available(iOS 16.0, *)
struct OutspendShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(
      intent: AddTransactionIntent(),
      phrases: [
        "Add a transaction to \(.applicationName)",
        "Capture transaction in \(.applicationName)"
      ],
      shortTitle: "Add transaction",
      systemImageName: "indianrupeesign.circle"
    )
  }
}
