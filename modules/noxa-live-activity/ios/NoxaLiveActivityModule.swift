import ActivityKit
import ExpoModulesCore
import Foundation

@available(iOS 16.2, *)
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

struct NoxaDriveLiveActivityStateRecord: Record {
    @Field var driveSessionId: String = ""
    @Field var destinationTitle: String = "Drive Together"
    @Field var etaMinutes: Int? = nil
    @Field var remainingDistanceMeters: Double? = nil
    @Field var participantCount: Int = 1
    @Field var progress: Double? = nil
    @Field var status: String = "active"

    @available(iOS 16.2, *)
    func contentState() -> NoxaDriveActivityAttributes.ContentState {
        NoxaDriveActivityAttributes.ContentState(
            destinationTitle: destinationTitle,
            etaMinutes: etaMinutes,
            remainingDistanceMeters: remainingDistanceMeters,
            participantCount: max(1, participantCount),
            progress: progress.map { min(max($0, 0), 1) },
            status: status
        )
    }
}

public final class NoxaLiveActivityModule: Module {
    public func definition() -> ModuleDefinition {
        Name("NoxaLiveActivity")

        Function("isSupported") {
            if #available(iOS 16.2, *) {
                return true
            }
            return false
        }

        Function("areLiveActivitiesEnabled") {
            if #available(iOS 16.2, *) {
                return ActivityAuthorizationInfo().areActivitiesEnabled
            }
            return false
        }

        AsyncFunction("startDriveActivity") { (record: NoxaDriveLiveActivityStateRecord) async -> String? in
            guard #available(iOS 16.2, *),
                  ActivityAuthorizationInfo().areActivitiesEnabled,
                  !record.driveSessionId.isEmpty else {
                return nil
            }

            let content = ActivityContent(state: record.contentState(), staleDate: nil)
            if let existing = self.activity(for: record.driveSessionId) {
                await existing.update(content)
                return existing.id
            }

            do {
                let activity = try Activity.request(
                    attributes: NoxaDriveActivityAttributes(driveSessionId: record.driveSessionId),
                    content: content,
                    pushType: nil
                )
                return activity.id
            } catch {
                return nil
            }
        }

        AsyncFunction("updateDriveActivity") { (record: NoxaDriveLiveActivityStateRecord) async -> Bool in
            guard #available(iOS 16.2, *),
                  let activity = self.activity(for: record.driveSessionId) else {
                return false
            }

            await activity.update(ActivityContent(state: record.contentState(), staleDate: nil))
            return true
        }

        AsyncFunction("endDriveActivity") { (driveSessionId: String) async -> Bool in
            guard #available(iOS 16.2, *) else { return false }
            let matching = Activity<NoxaDriveActivityAttributes>.activities.filter {
                $0.attributes.driveSessionId == driveSessionId
            }
            guard !matching.isEmpty else { return false }

            for activity in matching {
                await activity.end(nil, dismissalPolicy: .immediate)
            }
            return true
        }

        AsyncFunction("endAllDriveActivities") { () async -> Bool in
            guard #available(iOS 16.2, *) else { return false }
            let activities = Activity<NoxaDriveActivityAttributes>.activities
            guard !activities.isEmpty else { return false }

            for activity in activities {
                await activity.end(nil, dismissalPolicy: .immediate)
            }
            return true
        }
    }

    @available(iOS 16.2, *)
    private func activity(
        for driveSessionId: String
    ) -> Activity<NoxaDriveActivityAttributes>? {
        Activity<NoxaDriveActivityAttributes>.activities.first {
            $0.attributes.driveSessionId == driveSessionId
        }
    }
}
