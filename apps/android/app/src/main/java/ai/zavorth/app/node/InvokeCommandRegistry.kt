package dev.zavorth.companion.node

import dev.zavorth.companion.protocol.ZavorthCalendarCommand
import dev.zavorth.companion.protocol.ZavorthCallLogCommand
import dev.zavorth.companion.protocol.ZavorthCameraCommand
import dev.zavorth.companion.protocol.ZavorthCanvasA2UICommand
import dev.zavorth.companion.protocol.ZavorthCanvasCommand
import dev.zavorth.companion.protocol.ZavorthCapability
import dev.zavorth.companion.protocol.ZavorthContactsCommand
import dev.zavorth.companion.protocol.ZavorthDeviceCommand
import dev.zavorth.companion.protocol.ZavorthLocationCommand
import dev.zavorth.companion.protocol.ZavorthMotionCommand
import dev.zavorth.companion.protocol.ZavorthNotificationsCommand
import dev.zavorth.companion.protocol.ZavorthPhotosCommand
import dev.zavorth.companion.protocol.ZavorthSmsCommand
import dev.zavorth.companion.protocol.ZavorthSystemCommand
import dev.zavorth.companion.protocol.ZavorthTalkCommand

/** Runtime feature flags used to decide which node tools are advertised. */
data class NodeRuntimeFlags(
  val cameraEnabled: Boolean,
  val locationEnabled: Boolean,
  val sendSmsAvailable: Boolean,
  val readSmsAvailable: Boolean,
  val smsSearchPossible: Boolean,
  val callLogAvailable: Boolean,
  val photosAvailable: Boolean,
  val voiceWakeEnabled: Boolean,
  val motionActivityAvailable: Boolean,
  val motionPedometerAvailable: Boolean,
  val installedAppsSharingEnabled: Boolean,
  val debugBuild: Boolean,
)

/** Per-command availability gates checked before advertising invoke methods. */
enum class InvokeCommandAvailability {
  Always,
  CameraEnabled,
  LocationEnabled,
  SendSmsAvailable,
  ReadSmsAvailable,
  RequestableSmsSearchAvailable,
  CallLogAvailable,
  PhotosAvailable,
  MotionActivityAvailable,
  MotionPedometerAvailable,
  InstalledAppsSharingEnabled,
  DebugBuild,
}

/** Per-capability availability gates for the node capabilities manifest. */
enum class NodeCapabilityAvailability {
  Always,
  CameraEnabled,
  LocationEnabled,
  SmsAvailable,
  CallLogAvailable,
  PhotosAvailable,
  VoiceWakeEnabled,
  MotionAvailable,
}

/** Capability entry reported to the gateway when its availability gate passes. */
data class NodeCapabilitySpec(
  val name: String,
  val availability: NodeCapabilityAvailability = NodeCapabilityAvailability.Always,
)

/** Invoke method entry advertised to gateway plus foreground routing metadata. */
data class InvokeCommandSpec(
  val name: String,
  val requiresForeground: Boolean = false,
  val availability: InvokeCommandAvailability = InvokeCommandAvailability.Always,
)

object InvokeCommandRegistry {
  /** Capabilities mirror gateway protocol ids and are filtered by device state. */
  val capabilityManifest: List<NodeCapabilitySpec> =
    listOf(
      NodeCapabilitySpec(name = ZavorthCapability.Canvas.rawValue),
      NodeCapabilitySpec(name = ZavorthCapability.Device.rawValue),
      NodeCapabilitySpec(name = ZavorthCapability.Notifications.rawValue),
      NodeCapabilitySpec(name = ZavorthCapability.System.rawValue),
      NodeCapabilitySpec(
        name = ZavorthCapability.Camera.rawValue,
        availability = NodeCapabilityAvailability.CameraEnabled,
      ),
      NodeCapabilitySpec(
        name = ZavorthCapability.Sms.rawValue,
        availability = NodeCapabilityAvailability.SmsAvailable,
      ),
      NodeCapabilitySpec(
        name = ZavorthCapability.VoiceWake.rawValue,
        availability = NodeCapabilityAvailability.VoiceWakeEnabled,
      ),
      NodeCapabilitySpec(name = ZavorthCapability.Talk.rawValue),
      NodeCapabilitySpec(
        name = ZavorthCapability.Location.rawValue,
        availability = NodeCapabilityAvailability.LocationEnabled,
      ),
      NodeCapabilitySpec(
        name = ZavorthCapability.Photos.rawValue,
        availability = NodeCapabilityAvailability.PhotosAvailable,
      ),
      NodeCapabilitySpec(name = ZavorthCapability.Contacts.rawValue),
      NodeCapabilitySpec(name = ZavorthCapability.Calendar.rawValue),
      NodeCapabilitySpec(
        name = ZavorthCapability.Motion.rawValue,
        availability = NodeCapabilityAvailability.MotionAvailable,
      ),
      NodeCapabilitySpec(
        name = ZavorthCapability.CallLog.rawValue,
        availability = NodeCapabilityAvailability.CallLogAvailable,
      ),
    )

  /** Complete Android node command catalog before runtime availability filtering. */
  val all: List<InvokeCommandSpec> =
    listOf(
      InvokeCommandSpec(
        name = ZavorthCanvasCommand.Present.rawValue,
        requiresForeground = true,
      ),
      InvokeCommandSpec(
        name = ZavorthCanvasCommand.Hide.rawValue,
        requiresForeground = true,
      ),
      InvokeCommandSpec(
        name = ZavorthCanvasCommand.Navigate.rawValue,
        requiresForeground = true,
      ),
      InvokeCommandSpec(
        name = ZavorthCanvasCommand.Eval.rawValue,
        requiresForeground = true,
      ),
      InvokeCommandSpec(
        name = ZavorthCanvasCommand.Snapshot.rawValue,
        requiresForeground = true,
      ),
      InvokeCommandSpec(
        name = ZavorthCanvasA2UICommand.Push.rawValue,
        requiresForeground = true,
      ),
      InvokeCommandSpec(
        name = ZavorthCanvasA2UICommand.PushJSONL.rawValue,
        requiresForeground = true,
      ),
      InvokeCommandSpec(
        name = ZavorthCanvasA2UICommand.Reset.rawValue,
        requiresForeground = true,
      ),
      InvokeCommandSpec(
        name = ZavorthSystemCommand.Notify.rawValue,
      ),
      InvokeCommandSpec(
        name = ZavorthTalkCommand.PttStart.rawValue,
      ),
      InvokeCommandSpec(
        name = ZavorthTalkCommand.PttStop.rawValue,
      ),
      InvokeCommandSpec(
        name = ZavorthTalkCommand.PttCancel.rawValue,
      ),
      InvokeCommandSpec(
        name = ZavorthTalkCommand.PttOnce.rawValue,
      ),
      InvokeCommandSpec(
        name = ZavorthCameraCommand.List.rawValue,
        requiresForeground = true,
        availability = InvokeCommandAvailability.CameraEnabled,
      ),
      InvokeCommandSpec(
        name = ZavorthCameraCommand.Snap.rawValue,
        requiresForeground = true,
        availability = InvokeCommandAvailability.CameraEnabled,
      ),
      InvokeCommandSpec(
        name = ZavorthCameraCommand.Clip.rawValue,
        requiresForeground = true,
        availability = InvokeCommandAvailability.CameraEnabled,
      ),
      InvokeCommandSpec(
        name = ZavorthLocationCommand.Get.rawValue,
        availability = InvokeCommandAvailability.LocationEnabled,
      ),
      InvokeCommandSpec(
        name = ZavorthDeviceCommand.Status.rawValue,
      ),
      InvokeCommandSpec(
        name = ZavorthDeviceCommand.Info.rawValue,
      ),
      InvokeCommandSpec(
        name = ZavorthDeviceCommand.Permissions.rawValue,
      ),
      InvokeCommandSpec(
        name = ZavorthDeviceCommand.Health.rawValue,
      ),
      InvokeCommandSpec(
        name = ZavorthDeviceCommand.Apps.rawValue,
        availability = InvokeCommandAvailability.InstalledAppsSharingEnabled,
      ),
      InvokeCommandSpec(
        name = ZavorthNotificationsCommand.List.rawValue,
      ),
      InvokeCommandSpec(
        name = ZavorthNotificationsCommand.Actions.rawValue,
      ),
      InvokeCommandSpec(
        name = ZavorthPhotosCommand.Latest.rawValue,
        availability = InvokeCommandAvailability.PhotosAvailable,
      ),
      InvokeCommandSpec(
        name = ZavorthContactsCommand.Search.rawValue,
      ),
      InvokeCommandSpec(
        name = ZavorthContactsCommand.Add.rawValue,
      ),
      InvokeCommandSpec(
        name = ZavorthCalendarCommand.Events.rawValue,
      ),
      InvokeCommandSpec(
        name = ZavorthCalendarCommand.Add.rawValue,
      ),
      InvokeCommandSpec(
        name = ZavorthMotionCommand.Activity.rawValue,
        availability = InvokeCommandAvailability.MotionActivityAvailable,
      ),
      InvokeCommandSpec(
        name = ZavorthMotionCommand.Pedometer.rawValue,
        availability = InvokeCommandAvailability.MotionPedometerAvailable,
      ),
      InvokeCommandSpec(
        name = ZavorthSmsCommand.Send.rawValue,
        availability = InvokeCommandAvailability.SendSmsAvailable,
      ),
      InvokeCommandSpec(
        name = ZavorthSmsCommand.Search.rawValue,
        availability = InvokeCommandAvailability.RequestableSmsSearchAvailable,
      ),
      InvokeCommandSpec(
        name = ZavorthCallLogCommand.Search.rawValue,
        availability = InvokeCommandAvailability.CallLogAvailable,
      ),
      InvokeCommandSpec(
        name = "debug.logs",
        availability = InvokeCommandAvailability.DebugBuild,
      ),
      InvokeCommandSpec(
        name = "debug.ed25519",
        availability = InvokeCommandAvailability.DebugBuild,
      ),
    )

  private val byNameInternal: Map<String, InvokeCommandSpec> = all.associateBy { it.name }

  /** Finds the command metadata used by dispatch and advertised-method builders. */
  fun find(command: String): InvokeCommandSpec? = byNameInternal[command]

  /** Returns gateway capability ids the current Android device can actually serve. */
  fun advertisedCapabilities(flags: NodeRuntimeFlags): List<String> =
    capabilityManifest
      .filter { spec ->
        when (spec.availability) {
          NodeCapabilityAvailability.Always -> true
          NodeCapabilityAvailability.CameraEnabled -> flags.cameraEnabled
          NodeCapabilityAvailability.LocationEnabled -> flags.locationEnabled
          NodeCapabilityAvailability.SmsAvailable -> flags.sendSmsAvailable || flags.readSmsAvailable
          NodeCapabilityAvailability.CallLogAvailable -> flags.callLogAvailable
          NodeCapabilityAvailability.PhotosAvailable -> flags.photosAvailable
          NodeCapabilityAvailability.VoiceWakeEnabled -> flags.voiceWakeEnabled
          NodeCapabilityAvailability.MotionAvailable -> flags.motionActivityAvailable || flags.motionPedometerAvailable
        }
      }.map { it.name }

  /** Returns gateway invoke method ids available under current permissions/build flags. */
  fun advertisedCommands(flags: NodeRuntimeFlags): List<String> =
    all
      .filter { spec ->
        when (spec.availability) {
          InvokeCommandAvailability.Always -> true
          InvokeCommandAvailability.CameraEnabled -> flags.cameraEnabled
          InvokeCommandAvailability.LocationEnabled -> flags.locationEnabled
          InvokeCommandAvailability.SendSmsAvailable -> flags.sendSmsAvailable
          InvokeCommandAvailability.ReadSmsAvailable -> flags.readSmsAvailable
          InvokeCommandAvailability.RequestableSmsSearchAvailable -> flags.smsSearchPossible
          InvokeCommandAvailability.CallLogAvailable -> flags.callLogAvailable
          InvokeCommandAvailability.PhotosAvailable -> flags.photosAvailable
          InvokeCommandAvailability.MotionActivityAvailable -> flags.motionActivityAvailable
          InvokeCommandAvailability.MotionPedometerAvailable -> flags.motionPedometerAvailable
          InvokeCommandAvailability.InstalledAppsSharingEnabled -> flags.installedAppsSharingEnabled
          InvokeCommandAvailability.DebugBuild -> flags.debugBuild
        }
      }.map { it.name }
}
