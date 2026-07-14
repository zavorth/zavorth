import SwiftUI

struct ZavorthDocsScreen: View {
    private let docsURL = URL(string: "https://docs.zavorth.ai")!
    private let gatewayURL = URL(string: "https://docs.zavorth.ai/gateway")!
    private let pairingURL = URL(string: "https://docs.zavorth.ai/channels/pairing")!
    let headerLeadingAction: ZavorthSidebarHeaderAction?
    let gatewayAction: (() -> Void)?

    init(headerLeadingAction: ZavorthSidebarHeaderAction? = nil, gatewayAction: (() -> Void)? = nil) {
        self.headerLeadingAction = headerLeadingAction
        self.gatewayAction = gatewayAction
    }

    var body: some View {
        ZStack {
            ZavorthProBackground()
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    self.headerCard
                    self.linkCard
                    self.versionCard
                }
                .padding(.vertical, 18)
            }
        }
        .navigationTitle("Docs")
        .navigationBarTitleDisplayMode(.inline)
    }

    private var headerCard: some View {
        ProCard(radius: ZavorthProMetric.cardRadius) {
            ZavorthAdaptiveHeaderRow(
                title: "Docs",
                subtitle: "Gateway setup, pairing, channels, and mobile node reference.",
                titleFont: .headline,
                subtitleFont: .caption)
            {
                HStack(alignment: .top, spacing: 12) {
                    if let headerLeadingAction {
                        ZavorthSidebarHeaderLeadingSlot(action: headerLeadingAction)
                    }
                    ProIconBadge(systemName: "book", color: ZavorthBrand.accent)
                }
            } accessory: {
                self.gatewayPill
            }
        }
        .padding(.horizontal, ZavorthProMetric.pagePadding)
    }

    @ViewBuilder
    private var gatewayPill: some View {
        if let gatewayAction {
            Button(action: gatewayAction) {
                ZavorthGatewayCompactPill()
            }
            .buttonStyle(.plain)
            .accessibilityHint("Opens Settings / Gateway")
        } else {
            ZavorthGatewayCompactPill()
        }
    }

    private var linkCard: some View {
        ProCard(padding: 0, radius: ZavorthProMetric.cardRadius) {
            VStack(spacing: 0) {
                self.docsLinkRow(
                    title: "Docs Home",
                    detail: "Browse the current Zavorth reference.",
                    icon: "book",
                    url: self.docsURL)
                Divider().padding(.leading, 58)
                self.docsLinkRow(
                    title: "Gateway",
                    detail: "Connection, auth, and diagnostics.",
                    icon: "network",
                    url: self.gatewayURL)
                Divider().padding(.leading, 58)
                self.docsLinkRow(
                    title: "Pairing",
                    detail: "Mobile setup codes, QR, and node approval.",
                    icon: "qrcode",
                    url: self.pairingURL)
            }
        }
        .padding(.horizontal, ZavorthProMetric.pagePadding)
    }

    private var versionCard: some View {
        ProCard(radius: ZavorthProMetric.cardRadius) {
            HStack(spacing: 10) {
                Text("Version")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                Spacer(minLength: 8)
                Text("v\(DeviceInfoHelper.zavorthVersionString())")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(.primary)
                    .textSelection(.enabled)
            }
        }
        .padding(.horizontal, ZavorthProMetric.pagePadding)
    }

    private func docsLinkRow(title: String, detail: String, icon: String, url: URL) -> some View {
        Link(destination: url) {
            HStack(spacing: 12) {
                ProIconBadge(systemName: icon, color: ZavorthBrand.accent)
                VStack(alignment: .leading, spacing: 3) {
                    Text(title)
                        .font(.subheadline.weight(.semibold))
                    Text(detail)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
                Spacer(minLength: 8)
                Image(systemName: "arrow.up.right")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(.secondary)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}
