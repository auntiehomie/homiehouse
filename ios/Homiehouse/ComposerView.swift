import SwiftUI

struct ComposerView: View {
    @ObservedObject var bridge: SignerBridge
    var parent: Cast? = nil
    var onPublished: () -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var text = ""
    @State private var sending = false
    @State private var error: String?
    @State private var connect = false
    private var valid: Bool { !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && text.utf8.count <= 1024 }
    var body: some View {
        NavigationStack {
            Form {
                if let parent { Section("Replying to \(parent.author.name)") { Text(parent.text ?? "").lineLimit(3) } }
                TextEditor(text: $text).frame(minHeight: 180).accessibilityLabel("Cast text")
                Text("\(text.utf8.count) / 1,024 bytes").foregroundStyle(text.utf8.count > 1024 ? .red : .secondary)
                if !bridge.status.canPublish { Button("Connect account and signer") { connect = true } }
                if let error { Text(error).foregroundStyle(.red) }
            }
            .scrollContentBackground(.hidden)
            .background(Color(uiColor: .systemGroupedBackground))
            .navigationTitle(parent == nil ? "New cast" : "Reply")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() }.disabled(sending) }
                ToolbarItem(placement: .confirmationAction) {
                    Button(sending ? "Publishing…" : "Publish") { Task { await publish() } }
                        .fontWeight(.semibold)
                        .disabled(sending || !valid || !bridge.status.canPublish)
                }
            }
            .sheet(isPresented: $connect) { ConnectView(bridge: bridge) }
            .interactiveDismissDisabled(sending)
        }
    }
    private func publish() async {
        sending = true; error = nil
        defer { sending = false }
        do { _ = try await bridge.publish(text: text, parent: parent); onPublished(); dismiss() }
        catch { self.error = error.localizedDescription }
    }
}
