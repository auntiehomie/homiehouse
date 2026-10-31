import SwiftUI

/// Shared native tokens aligned with Homiehouse's responsive web client.
/// System colors and fonts remain adaptive to appearance and Dynamic Type.
enum HHDesignSystem {
    static let tint = Color(red: 0.204, green: 0.827, blue: 0.600)
    static let contentWidth: CGFloat = 760

    enum Spacing {
        static let compact: CGFloat = 8
        static let regular: CGFloat = 16
        static let spacious: CGFloat = 24
    }
}
