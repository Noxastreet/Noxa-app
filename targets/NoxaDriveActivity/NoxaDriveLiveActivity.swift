import ActivityKit
import Foundation
import SwiftUI
import WidgetKit

struct NoxaDriveActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var destinationTitle: String
        var etaMinutes: Int?
        var remainingDistanceMeters: Double?
        var participantCount: Int
        var progress: Double?
        var status: String
    }

    var driveSessionId: String
}

private extension NoxaDriveActivityAttributes.ContentState {
    var safeProgress: Double {
        min(max(progress ?? 0, 0), 1)
    }

    var etaLabel: String? {
        guard let etaMinutes else { return nil }
        if etaMinutes < 1 { return "<1 min" }
        return "\(etaMinutes) min"
    }

    var distanceLabel: String? {
        guard let meters = remainingDistanceMeters, meters.isFinite, meters >= 0 else {
            return nil
        }
        if meters < 1_000 {
            return "\(Int(meters.rounded())) m"
        }
        return String(format: "%.1f km", meters / 1_000)
    }
}

struct NoxaDriveLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: NoxaDriveActivityAttributes.self) { context in
            lockScreenView(context)
                .activityBackgroundTint(Color.black.opacity(0.94))
                .activitySystemActionForegroundColor(.white)
                .widgetURL(deepLink(context.attributes.driveSessionId))
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    HStack(spacing: 6) {
                        Image(systemName: "car.fill")
                            .foregroundStyle(.red)
                        Text("NOXA")
                            .font(.caption.bold())
                    }
                }

                DynamicIslandExpandedRegion(.trailing) {
                    Text(context.state.etaLabel ?? context.state.distanceLabel ?? "LIVE")
                        .font(.caption.bold())
                        .monospacedDigit()
                }

                DynamicIslandExpandedRegion(.center) {
                    Text(context.state.destinationTitle)
                        .font(.caption)
                        .lineLimit(1)
                        .privacySensitive()
                }

                DynamicIslandExpandedRegion(.bottom) {
                    VStack(alignment: .leading, spacing: 6) {
                        ProgressView(value: context.state.safeProgress)
                            .tint(.red)
                        HStack {
                            Label("\(max(1, context.state.participantCount))", systemImage: "person.2.fill")
                            Spacer()
                            if let distance = context.state.distanceLabel {
                                Text(distance)
                                    .monospacedDigit()
                            }
                        }
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                    }
                }
            } compactLeading: {
                Image(systemName: "car.fill")
                    .foregroundStyle(.red)
                    .accessibilityLabel("NOXA Drive Together")
            } compactTrailing: {
                Text(context.state.etaLabel ?? context.state.distanceLabel ?? "LIVE")
                    .font(.caption2.bold())
                    .monospacedDigit()
            } minimal: {
                Image(systemName: "car.fill")
                    .foregroundStyle(.red)
                    .accessibilityLabel("NOXA Drive Together")
            }
            .widgetURL(deepLink(context.attributes.driveSessionId))
            .keylineTint(.red.opacity(0.72))
        }
    }

    @ViewBuilder
    private func lockScreenView(
        _ context: ActivityViewContext<NoxaDriveActivityAttributes>
    ) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                Image(systemName: "car.fill")
                    .foregroundStyle(.red)
                Text("NOXA · DRIVE TOGETHER")
                    .font(.caption.bold())
                    .tracking(0.8)
                Spacer()
                if let eta = context.state.etaLabel {
                    Text(eta)
                        .font(.headline.bold())
                        .monospacedDigit()
                }
            }

            Text(context.state.destinationTitle)
                .font(.headline)
                .lineLimit(1)
                .privacySensitive()

            ProgressView(value: context.state.safeProgress)
                .tint(.red)

            HStack {
                Label("\(max(1, context.state.participantCount)) drivers", systemImage: "person.2.fill")
                Spacer()
                if let distance = context.state.distanceLabel {
                    Text(distance)
                        .monospacedDigit()
                }
            }
            .font(.caption)
            .foregroundStyle(.secondary)
        }
        .padding(.vertical, 4)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(accessibilitySummary(context.state))
    }

    private func deepLink(_ driveSessionId: String) -> URL? {
        URL(string: "noxa://drive-together/\(driveSessionId)")
    }

    private func accessibilitySummary(
        _ state: NoxaDriveActivityAttributes.ContentState
    ) -> String {
        var pieces = ["NOXA Drive Together", state.destinationTitle]
        if let eta = state.etaLabel { pieces.append(eta) }
        if let distance = state.distanceLabel { pieces.append(distance) }
        pieces.append("\(max(1, state.participantCount)) drivers")
        return pieces.joined(separator: ", ")
    }
}
