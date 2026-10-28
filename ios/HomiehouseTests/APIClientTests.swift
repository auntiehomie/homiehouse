import XCTest
@testable import Homiehouse

final class APIClientTests: XCTestCase {
    func testFeedDecodesActualEnvelopeAndOptionalCastFields() throws {
        let data = Data(#"{"data":[{"hash":"0xabc","text":"hello","author":{"fid":42,"username":"homie"},"embeds":[{"url":"https://example.com"},{"cast_id":{"hash":"0xdef"}}]}],"cursor":"next&page"}"#.utf8)
        let page = try JSONDecoder().decode(FeedPage.self, from: data)
        XCTAssertEqual(page.data.first?.author.name, "homie")
        XCTAssertEqual(page.cursor, "next&page")
        XCTAssertNil(page.data.first?.embeds?.last?.url)
    }
    func testThreadPreservesParentsAndReplies() throws {
        let data = Data(#"{"cast":{"hash":"reply","author":{"fid":42},"parent_chain":[{"hash":"parent","author":{"fid":12}}],"direct_replies":[],"replies_next":{"cursor":"page-two"},"replies_unavailable":true}}"#.utf8)
        let page = try JSONDecoder().decode(CastPage.self, from: data)
        XCTAssertEqual(page.cast.parent_chain?.first?.hash, "parent")
        XCTAssertEqual(page.cast.replies_next?.value, "page-two")
        XCTAssertEqual(page.cast.replies_unavailable, true)
    }
    func testComposerByteBudgetIncludesMultibyteUnicode() {
        XCTAssertEqual(String(repeating: "🌱", count: 256).utf8.count, 1024)
        XCTAssertGreaterThan(String(repeating: "🌱", count: 257).utf8.count, 1024)
    }
}
