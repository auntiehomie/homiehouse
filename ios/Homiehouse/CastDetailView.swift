import SwiftUI

struct CastDetailView: View {
    let cast: Cast
    let api: APIClient
    @ObservedObject var bridge: SignerBridge
    @State private var detail: Cast?
    @State private var replies: [Cast] = []
    @State private var cursor: String?
    @State private var error: String?
    @State private var loading = false
    @State private var replying = false
    var body: some View {
        List {
            if loading { ProgressView() }
            if let error { Text(error).foregroundStyle(.red); Button("Retry") { Task { await load(more: cursor != nil) } } }
            ForEach(detail?.parent_chain ?? []) { parent in
                NavigationLink { CastDetailView(cast: parent, api: api, bridge: bridge) } label: { CastRow(cast: parent) }
            }
            Section {
                CastRow(cast: detail ?? cast)
                Button("Reply", systemImage: "arrowshape.turn.up.left") { replying = true }
            }
            if detail?.replies_unavailable == true { Text("Some replies could not be loaded from the node.").foregroundStyle(.secondary) }
            Section("Replies") {
                ForEach(replies) { reply in
                    NavigationLink { CastDetailView(cast: reply, api: api, bridge: bridge) } label: { CastRow(cast: reply) }
                }
                if cursor != nil { Button("More replies") { Task { await load(more: true) } }.disabled(loading) }
            }
        }
        .navigationTitle("Conversation")
        .task { await load() }
        .refreshable { await load() }
        .sheet(isPresented: $replying) { ComposerView(bridge: bridge, parent: cast) { Task { await load() } } }
    }
    private func load(more: Bool = false) async {
        guard !loading else { return }
        loading = true; error = nil
        defer { loading = false }
        do {
            let page = try await api.cast(hash: cast.hash, cursor: more ? cursor : nil)
            detail = page
            var seen = Set((more ? replies : []).map(\.hash))
            replies = (more ? replies : []) + (page.direct_replies ?? []).filter { seen.insert($0.hash).inserted }
            let next = page.replies_next?.value
            cursor = more && next == cursor ? nil : next
        } catch { self.error = error.localizedDescription }
    }
}
