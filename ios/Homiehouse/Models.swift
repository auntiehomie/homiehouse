import Foundation

struct Cast: Decodable, Identifiable, Hashable {
    struct Author: Decodable, Hashable {
        let fid: Int
        let username: String?
        let display_name: String?
        let pfp_url: String?
        var name: String { display_name ?? username ?? "Community member" }
    }
    struct Embed: Decodable, Hashable { let url: String? }
    let hash: String
    let text: String?
    let author: Author
    let embeds: [Embed]?
    let parent_chain: [Cast]?
    let direct_replies: [Cast]?
    let replies_next: Cursor?
    let replies_unavailable: Bool?
    var id: String { hash }
}

// Feed cursors are strings; direct reply cursors can be { cursor: ... }.
struct Cursor: Decodable, Hashable {
    let value: String
    init(from decoder: Decoder) throws {
        let box = try decoder.singleValueContainer()
        if let string = try? box.decode(String.self) { value = string }
        else { value = try box.decode(Object.self).cursor }
    }
    private struct Object: Decodable { let cursor: String }
}
struct FeedPage: Decodable { let data: [Cast]; let cursor: String? }
struct CastPage: Decodable { let cast: Cast }
struct BridgeStatus: Equatable { let fid: Int?; let canPublish: Bool }
enum ClientError: LocalizedError {
    case message(String)
    var errorDescription: String? { if case .message(let text) = self { return text }; return nil }
}
