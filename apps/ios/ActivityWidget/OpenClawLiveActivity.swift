import ActivityKit
import SwiftUI
import WidgetKit

struct ZavorthLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: ZavorthActivityAttributes.self) { context in
            self.lockScreenView(context: context)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    self.statusDot(state: context.state)
                }
                DynamicIslandExpandedRegion(.center) {
                    Text(context.state.statusText)
                        .font(.subheadline.weight(.semibold))
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    self.trailingView(state: context.state)
                }
            } compactLeading: {
                self.statusDot(state: context.state)
            } compactTrailing: {
                self.compactStatusIcon(state: context.state)
            } minimal: {
                self.statusDot(state: context.state)
            }
        }
    }

    private func lockScreenView(context: ActivityViewContext<ZavorthActivityAttributes>) -> some View {
        HStack(spacing: 10) {
            self.statusIcon(state: context.state)
                .frame(width: 30, height: 30)
                .background(.thinMaterial, in: Circle())
            VStack(alignment: .leading, spacing: 2) {
                Text("Zavorth")
                    .font(.subheadline.bold())
                    .lineLimit(1)
                Text(context.state.statusText)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }
            Spacer()
            self.trailingView(state: context.state)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
    }

    private func trailingView(state: ZavorthActivityAttributes.ContentState) -> some View {
        self.statusIcon(state: state)
            .font(.system(size: 16, weight: .semibold))
            .frame(width: 28, height: 28)
    }

    private func statusDot(state: ZavorthActivityAttributes.ContentState) -> some View {
        Circle()
            .fill(self.dotColor(state: state))
            .frame(width: 6, height: 6)
    }

    private func compactStatusIcon(state: ZavorthActivityAttributes.ContentState) -> some View {
        self.statusIcon(state: state)
            .font(.system(size: 12, weight: .semibold))
            .frame(width: 18, height: 18)
    }

    @ViewBuilder
    private func statusIcon(state: ZavorthActivityAttributes.ContentState) -> some View {
        if state.isConnecting {
            Image(systemName: "arrow.triangle.2.circlepath")
                .foregroundStyle(ZavorthActivityStyle.info)
        } else if state.isDisconnected {
            Image(systemName: "wifi.slash")
                .foregroundStyle(ZavorthActivityStyle.danger)
        } else if state.isIdle {
            Image(systemName: "checkmark")
                .foregroundStyle(ZavorthActivityStyle.ok)
        } else {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(ZavorthActivityStyle.warn)
        }
    }

    private func dotColor(state: ZavorthActivityAttributes.ContentState) -> Color {
        if state.isDisconnected { return ZavorthActivityStyle.danger }
        if state.isConnecting { return ZavorthActivityStyle.info }
        if state.isIdle { return ZavorthActivityStyle.ok }
        return ZavorthActivityStyle.warn
    }
}

private enum ZavorthActivityStyle {
    static let info = Color(red: 0, green: 122 / 255.0, blue: 1)
    static let danger = Color(red: 185 / 255.0, green: 28 / 255.0, blue: 28 / 255.0)
    static let ok = Color(red: 34 / 255.0, green: 197 / 255.0, blue: 94 / 255.0)
    static let warn = Color(red: 245 / 255.0, green: 158 / 255.0, blue: 11 / 255.0)
}
