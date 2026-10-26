import SwiftUI

@MainActor final class FeedStore: ObservableObject {
    @Published var casts: [Cast] = []
    @Published var loading = false
    @Published var error: String?
    @Published var cursor: String?
    private var generation = 0
    func load(api: APIClient, type: String, fid: Int?, more: Bool = false) async {
        if more && (loading || cursor == nil) { return }
        generation += 1
        let requestGeneration = generation
        loading = true
        error = nil
        if !more { casts = []; cursor = nil }
        defer { if generation == requestGeneration { loading = false } }
        do {
            let page = try await api.feed(type: type, fid: fid, cursor: more ? cursor : nil)
            guard generation == requestGeneration, !Task.isCancelled else { return }
            var seen = Set(casts.map(\.hash))
            casts += page.data.filter { seen.insert($0.hash).inserted }
            cursor = page.cursor == cursor ? nil : page.cursor
        } catch {
            guard generation == requestGeneration, !Task.isCancelled else { return }
            self.error = error.localizedDescription
        }
    }
}
struct CommunityView: View {
    let api: APIClient
    @ObservedObject var bridge: SignerBridge
    @StateObject private var store = FeedStore()
    @State private var selected: Cast?
    @State private var type = "community"
    @State private var connect = false
    @State private var compose = false
    var body: some View {
        NavigationSplitView {
            List(selection: $selected) {
                Picker("Feed", selection: $type) {
                    Text("Community").tag("community")
                    if bridge.status.fid != nil { Text("Following").tag("following") }
                }.pickerStyle(.segmented)
                if let error = store.error {
                    Text(error).foregroundStyle(.red)
                    Button("Retry") { Task { await load() } }
                }
                if store.loading { ProgressView().accessibilityLabel("Loading casts") }
                if !store.loading && store.error == nil && store.casts.isEmpty { Text("No casts available yet.") }
                ForEach(store.casts) { cast in NavigationLink(value: cast) { CastRow(cast: cast) } }
                if store.cursor != nil {
                    Button("Load more") { Task { await load(more: true) } }.disabled(store.loading)
                }
            }
            .navigationTitle("Community")
            .refreshable { await load() }
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { Button("Account", systemImage: "person.crop.circle") { connect = true } }
                ToolbarItem(placement: .topBarTrailing) { Button("Compose", systemImage: "square.and.pencil") { compose = true } }
            }
        } detail: {
            if let selected { CastDetailView(cast: selected, api: api, bridge: bridge).id(selected.hash) }
            else { ContentUnavailableView("Your community", systemImage: "bubble.left.and.bubble.right", description: Text("Choose a cast to explore its conversation.")) }
        }
        .sheet(isPresented: $connect) { ConnectView(bridge: bridge) }
        .sheet(isPresented: $compose) { ComposerView(bridge: bridge) { Task { await load() } } }
        .task(id: "\(type)-\(bridge.status.fid ?? 0)") { selected = nil; await load() }
        .onChange(of: bridge.status.fid) { _, fid in if fid == nil { type = "community" } }
    }
    private func load(more: Bool = false) async { await store.load(api: api, type: type, fid: bridge.status.fid, more: more) }
}
struct CastRow: View {
    let cast: Cast
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                if let raw = cast.author.pfp_url, let url = URL(string: raw), url.scheme == "https" {
                    AsyncImage(url: url) { image in image.resizable().scaledToFill() } placeholder: { Image(systemName: "person.crop.circle") }
                        .frame(width: 32, height: 32).clipShape(Circle())
                }
                Text(cast.author.name).font(.headline)
            }
            Text(cast.text ?? "").textSelection(.enabled)
            ForEach(cast.embeds ?? [], id: \.self) { embed in
                if let raw = embed.url, let url = URL(string: raw), ["https", "http"].contains(url.scheme ?? "") {
                    Link(destination: url) { Label(url.host ?? raw, systemImage: "link").lineLimit(2) }
                }
            }
        }.padding(.vertical, 8)
    }
}
