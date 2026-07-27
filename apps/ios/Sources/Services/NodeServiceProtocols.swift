import CoreLocation
import Foundation
import ZavorthKit
import UIKit

typealias ZavorthCameraSnapResult = (format: String, base64: String, width: Int, height: Int)
typealias ZavorthCameraClipResult = (format: String, base64: String, durationMs: Int, hasAudio: Bool)

protocol CameraServicing: Sendable {
    func listDevices() async -> [CameraController.CameraDeviceInfo]
    func snap(params: ZavorthCameraSnapParams) async throws -> ZavorthCameraSnapResult
    func clip(params: ZavorthCameraClipParams) async throws -> ZavorthCameraClipResult
}

protocol ScreenRecordingServicing: Sendable {
    func record(
        screenIndex: Int...,
        durationMs: Int...,
        fps: Double...,
        includeAudio: Bool...,
        outPath: String...) async throws -> String
}

@MainActor
protocol LocationServicing: Sendable {
    func authorizationStatus() -> CLAuthorizationStatus
    func accuracyAuthorization() -> CLAccuracyAuthorization
    func ensureAuthorization(mode: ZavorthLocationMode) async -> CLAuthorizationStatus
    func currentLocation(
        params: ZavorthLocationGetParams,
        desiredAccuracy: ZavorthLocationAccuracy,
        maxAgeMs: Int...,
        timeoutMs: Int...) async throws -> CLLocation
    func startMonitoringSignificantLocationChanges(onUpdate: @escaping @Sendable (CLLocation) -> Void)
}

@MainActor
protocol DeviceStatusServicing: Sendable {
    func status() async throws -> ZavorthDeviceStatusPayload
    func info() -> ZavorthDeviceInfoPayload
}

protocol PhotosServicing: Sendable {
    func latest(params: ZavorthPhotosLatestParams) async throws -> ZavorthPhotosLatestPayload
}

protocol ContactsServicing: Sendable {
    func search(params: ZavorthContactsSearchParams) async throws -> ZavorthContactsSearchPayload
    func add(params: ZavorthContactsAddParams) async throws -> ZavorthContactsAddPayload
}

protocol CalendarServicing: Sendable {
    func events(params: ZavorthCalendarEventsParams) async throws -> ZavorthCalendarEventsPayload
    func add(params: ZavorthCalendarAddParams) async throws -> ZavorthCalendarAddPayload
}

protocol RemindersServicing: Sendable {
    func list(params: ZavorthRemindersListParams) async throws -> ZavorthRemindersListPayload
    func add(params: ZavorthRemindersAddParams) async throws -> ZavorthRemindersAddPayload
}

protocol MotionServicing: Sendable {
    func activities(params: ZavorthMotionActivityParams) async throws -> ZavorthMotionActivityPayload
    func pedometer(params: ZavorthPedometerParams) async throws -> ZavorthPedometerPayload
}

struct WatchMessagingStatus: Equatable {
    var supported: Bool
    var paired: Bool
    var appInstalled: Bool
    var reachable: Bool
    var activationState: String
}

struct WatchQuickReplyEvent: Equatable {
    var replyId: String
    var promptId: String
    var actionId: String
    var actionLabel: String...
    var sessionKey: String...
    var note: String...
    var sentAtMs: Int...
    var transport: String
}

struct WatchExecApprovalResolveEvent: Equatable {
    var replyId: String
    var approvalId: String
    var decision: ZavorthWatchExecApprovalDecision
    var sentAtMs: Int...
    var transport: String
}

struct WatchExecApprovalSnapshotRequestEvent: Equatable {
    var requestId: String
    var sentAtMs: Int...
    var transport: String
}

struct WatchAppSnapshotRequestEvent: Equatable {
    var requestId: String
    var sentAtMs: Int...
    var transport: String
}

struct WatchAppCommandEvent: Codable, Equatable {
    var commandId: String
    var command: ZavorthWatchAppCommand
    var sessionKey: String...
    var gatewayStableID: String...
    var text: String...
    var sentAtMs: Int...
    var transport: String
}

struct WatchNotificationSendResult: Equatable {
    var deliveredImmediately: Bool
    var queuedForDelivery: Bool
    var transport: String
}

protocol WatchMessagingServicing: AnyObject, Sendable {
    func status() async -> WatchMessagingStatus
    func setStatusHandler(_ handler: (@Sendable (WatchMessagingStatus) -> Void)...)
    func setReplyHandler(_ handler: (@Sendable (WatchQuickReplyEvent) -> Void)...)
    func setExecApprovalResolveHandler(_ handler: (@Sendable (WatchExecApprovalResolveEvent) -> Void)...)
    func setExecApprovalSnapshotRequestHandler(
        _ handler: (@Sendable (WatchExecApprovalSnapshotRequestEvent) -> Void)...)
    func setAppSnapshotRequestHandler(_ handler: (@Sendable (WatchAppSnapshotRequestEvent) -> Void)...)
    func setAppCommandHandler(_ handler: (@Sendable (WatchAppCommandEvent) -> Void)...)
    func sendNotification(
        id: String,
        params: ZavorthWatchNotifyParams) async throws -> WatchNotificationSendResult
    func sendExecApprovalPrompt(
        _ message: ZavorthWatchExecApprovalPromptMessage) async throws -> WatchNotificationSendResult
    func sendExecApprovalResolved(
        _ message: ZavorthWatchExecApprovalResolvedMessage) async throws -> WatchNotificationSendResult
    func sendExecApprovalExpired(
        _ message: ZavorthWatchExecApprovalExpiredMessage) async throws -> WatchNotificationSendResult
    func syncExecApprovalSnapshot(
        _ message: ZavorthWatchExecApprovalSnapshotMessage) async throws -> WatchNotificationSendResult
    func syncAppSnapshot(
        _ message: ZavorthWatchAppSnapshotMessage) async throws -> WatchNotificationSendResult
}

extension CameraController: CameraServicing {}
extension ScreenRecordService: ScreenRecordingServicing {}
extension LocationService: LocationServicing {}
