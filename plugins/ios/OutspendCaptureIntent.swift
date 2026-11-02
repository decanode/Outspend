import AppIntents
import Foundation

// "Add transaction to Outspend": a Shortcuts action that takes a bank message and queues it for the app.
// It runs in the background without opening the app (openAppWhenRun = false). The message is appended to
// Documents/pending-captures.jsonl; the app reads and clears that file the next time it opens
// (src/services/PendingCaptures.js). Nothing leaves the device.

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

    let dir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
    let file = dir.appendingPathComponent("pending-captures.jsonl")
    if !FileManager.default.fileExists(atPath: file.path) {
      FileManager.default.createFile(atPath: file.path, contents: nil)
    }
    if let handle = try? FileHandle(forWritingTo: file), let bytes = line.data(using: .utf8) {
      defer { try? handle.close() }
      _ = try? handle.seekToEnd()
      try? handle.write(contentsOf: bytes)
    }
    return .result()
  }
}

@available(iOS 16.0, *)
struct OutspendShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(
      intent: AddTransactionIntent(),
      phrases: ["Add a transaction to \(.applicationName)"],
      shortTitle: "Add transaction",
      systemImageName: "indianrupeesign.circle"
    )
  }
}
