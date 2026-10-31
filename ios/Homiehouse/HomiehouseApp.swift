import SwiftUI

@main struct HomiehouseApp: App {
    // HTTPS only. Change this constant to an HTTPS preview to test the bridge PR.
    static let baseURL = URL(string: "https://homiehouse.app")!
    @StateObject private var bridge = SignerBridge(baseURL: baseURL)
    var body: some Scene {
        WindowGroup {
            CommunityView(api: APIClient(baseURL: Self.baseURL), bridge: bridge)
                .tint(HHDesignSystem.tint)
        }
    }
}
