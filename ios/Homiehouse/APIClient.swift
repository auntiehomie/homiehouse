import Foundation

struct APIClient {
    let baseURL: URL
    var session: URLSession = .shared

    func feed(type: String, fid: Int?, cursor: String?) async throws -> FeedPage {
        var items = [URLQueryItem(name: "feed_type", value: type), URLQueryItem(name: "limit", value: "50")]
        if let fid { items.append(URLQueryItem(name: "fid", value: String(fid))) }
        if let cursor { items.append(URLQueryItem(name: "cursor", value: cursor)) }
        return try await get("api/feed", query: items)
    }
    func cast(hash: String, cursor: String? = nil) async throws -> Cast {
        var items = [URLQueryItem(name: "hash", value: hash)]
        if let cursor { items.append(URLQueryItem(name: "replies_cursor", value: cursor)) }
        let page: CastPage = try await get("api/cast", query: items)
        return page.cast
    }
    private func get<T: Decodable>(_ path: String, query: [URLQueryItem]) async throws -> T {
        var parts = URLComponents(url: baseURL.appendingPathComponent(path), resolvingAgainstBaseURL: false)!
        parts.queryItems = query
        var request = URLRequest(url: parts.url!)
        request.timeoutInterval = 30
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw ClientError.message("No server response.") }
        guard (200..<300).contains(http.statusCode) else {
            struct Failure: Decodable { let error: String? }
            let error = try? JSONDecoder().decode(Failure.self, from: data)
            throw ClientError.message(error?.error ?? "Request failed (\(http.statusCode)).")
        }
        return try JSONDecoder().decode(T.self, from: data)
    }
}
