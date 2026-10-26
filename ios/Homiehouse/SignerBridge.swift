import SwiftUI
import WebKit

/// Transitional adapter. Signing runs in an ephemeral web view; Keychain holds the saved signer.
@MainActor final class SignerBridge: NSObject, ObservableObject, WKNavigationDelegate, WKUIDelegate {
    let baseURL: URL
    let webView: WKWebView
    @Published var status = BridgeStatus(fid: nil, canPublish: false)
    @Published var error: String?
    @Published var ready = false

    init(baseURL: URL) {
        self.baseURL = baseURL
        let configuration = WKWebViewConfiguration()
        // Ephemeral storage prevents signer secrets being persisted in web localStorage.
        // Persist approved credentials only in device-local Keychain, then rehydrate this ephemeral view.
        configuration.websiteDataStore = .nonPersistent()
        webView = WKWebView(frame: .zero, configuration: configuration)
        super.init()
        webView.navigationDelegate = self
        webView.uiDelegate = self
        reload()
    }
    func reload() {
        ready = false
        error = nil
        webView.load(URLRequest(url: baseURL.appendingPathComponent("ios-connect")))
    }
    func isTrusted(_ url: URL?) -> Bool {
        guard let url else { return false }
        return url.scheme == "https" && url.host == baseURL.host && url.port == baseURL.port
    }
    private func call(_ body: String, arguments: [String: Any] = [:]) async throws -> Any? {
        guard ready, isTrusted(webView.url), webView.url?.path == "/ios-connect" else {
            throw ClientError.message("Connect your account first.")
        }
        return try await webView.callAsyncJavaScript(body, arguments: arguments, in: nil, contentWorld: .page)
    }
    func refreshStatus() async {
        do {
            guard let result = try await call("return window.homiehouseIOS.status();") as? [String: Any] else { return }
            status = BridgeStatus(fid: result["fid"] as? Int, canPublish: result["canPublish"] as? Bool ?? false)
            error = nil
        } catch { self.error = error.localizedDescription }
    }
    func saveAccount() async throws {
        if let account = try await call("return window.homiehouseIOS.saveAccount();") as? [String: Any] {
            try KeychainStore.save(JSONSerialization.data(withJSONObject: account))
        }
    }
    func publish(text: String, parent: Cast?) async throws -> String {
        var input: [String: Any] = ["text": text]
        if let parent { input["parentHash"] = parent.hash; input["parentFid"] = parent.author.fid }
        guard let hash = try await call("return await window.homiehouseIOS.publish(input);", arguments: ["input": input]) as? String, !hash.isEmpty else {
            throw ClientError.message("No publication confirmation. Check your profile before retrying.")
        }
        return hash
    }
    func signOut() async {
        do { try KeychainStore.clear() } catch { self.error = error.localizedDescription; return }
        _ = try? await call("return await window.homiehouseIOS.signOut();")
        status = BridgeStatus(fid: nil, canPublish: false)
        webView.configuration.websiteDataStore.removeData(ofTypes: WKWebsiteDataStore.allWebsiteDataTypes(), modifiedSince: .distantPast) { [weak self] in
            Task { @MainActor in self?.reload() }
        }
    }
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        guard isTrusted(webView.url), webView.url?.path == "/ios-connect" else { ready = false; return }
        Task {
            // didFinish may precede React hydration. Wait for the adapter handshake.
            for _ in 0..<50 {
                guard isTrusted(webView.url), webView.url?.path == "/ios-connect" else { return }
                if (try? await webView.evaluateJavaScript("typeof window.homiehouseIOS === 'object'")) as? Bool == true {
                    ready = true
                    do {
                        if let data = try KeychainStore.load(), let account = try JSONSerialization.jsonObject(with: data) as? [String: Any] {
                            _ = try await call("return window.homiehouseIOS.restoreAccount(account);", arguments: ["account": account])
                            try await Task.sleep(for: .milliseconds(200))
                        }
                        await refreshStatus()
                    } catch { self.error = error.localizedDescription }
                    return
                }
                try? await Task.sleep(for: .milliseconds(100))
            }
            error = "The connection adapter is unavailable. Deploy the matching web changes, then reload."
        }
    }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        self.error = error.localizedDescription
    }
    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = action.request.url else { decisionHandler(.cancel); return }
        if action.targetFrame?.isMainFrame != false && !isTrusted(url) {
            decisionHandler(.cancel)
            // Universal links and wallet deep links are user initiated only.
            if ["https", "walletconnect", "metamask", "rainbow", "cbwallet"].contains(url.scheme ?? ""), action.navigationType == .linkActivated || ["walletconnect", "metamask", "rainbow", "cbwallet"].contains(url.scheme ?? "") { UIApplication.shared.open(url) }
            return
        }
        decisionHandler(.allow)
    }
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = action.request.url, action.navigationType == .linkActivated { UIApplication.shared.open(url) }
        return nil
    }
}

struct ConnectView: View {
    @ObservedObject var bridge: SignerBridge
    @Environment(\.dismiss) private var dismiss
    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                if let error = bridge.error {
                    Text(error).foregroundStyle(.red).padding()
                    Button("Reload connection", action: bridge.reload)
                }
                BridgeWebView(bridge: bridge)
                if bridge.status.fid != nil {
                    Button("Sign out", role: .destructive) { Task { await bridge.signOut() } }.padding()
                }
            }
            .navigationTitle("Account")
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { Task {
                        await bridge.refreshStatus()
                        do { try await bridge.saveAccount(); if bridge.status.fid != nil { dismiss() } }
                        catch { bridge.error = error.localizedDescription }
                    } }
                        .disabled(!bridge.ready)
                }
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
            }
        }
    }
}
private struct BridgeWebView: UIViewRepresentable {
    let bridge: SignerBridge
    func makeUIView(context: Context) -> WKWebView { bridge.webView }
    func updateUIView(_ view: WKWebView, context: Context) {}
}
