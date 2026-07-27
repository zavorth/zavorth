package dev.zavorth.companion.node

import dev.zavorth.companion.protocol.ZavorthCalendarCommand
import dev.zavorth.companion.protocol.ZavorthCallLogCommand
import dev.zavorth.companion.protocol.ZavorthCameraCommand
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
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class InvokeCommandRegistryTest {
  private val coreCapabilities =
    setOf(
      ZavorthCapability.Canvas.rawValue,
      ZavorthCapability.Device.rawValue,
      ZavorthCapability.Notifications.rawValue,
      ZavorthCapability.System.rawValue,
      ZavorthCapability.Talk.rawValue,
      ZavorthCapability.Contacts.rawValue,
      ZavorthCapability.Calendar.rawValue,
    )

  private val optionalCapabilities =
    setOf(
      ZavorthCapability.Camera.rawValue,
      ZavorthCapability.Location.rawValue,
      ZavorthCapability.Sms.rawValue,
      ZavorthCapability.CallLog.rawValue,
      ZavorthCapability.VoiceWake.rawValue,
      ZavorthCapability.Motion.rawValue,
      ZavorthCapability.Photos.rawValue,
    )

  private val coreCommands =
    setOf(
      ZavorthDeviceCommand.Status.rawValue,
      ZavorthDeviceCommand.Info.rawValue,
      ZavorthDeviceCommand.Permissions.rawValue,
      ZavorthDeviceCommand.Health.rawValue,
      ZavorthNotificationsCommand.List.rawValue,
      ZavorthNotificationsCommand.Actions.rawValue,
      ZavorthSystemCommand.Notify.rawValue,
      ZavorthTalkCommand.PttStart.rawValue,
      ZavorthTalkCommand.PttStop.rawValue,
      ZavorthTalkCommand.PttCancel.rawValue,
      ZavorthTalkCommand.PttOnce.rawValue,
      ZavorthContactsCommand.Search.rawValue,
      ZavorthContactsCommand.Add.rawValue,
      ZavorthCalendarCommand.Events.rawValue,
      ZavorthCalendarCommand.Add.rawValue,
    )

  private val optionalCommands =
    setOf(
      ZavorthCameraCommand.Snap.rawValue,
      ZavorthCameraCommand.Clip.rawValue,
      ZavorthCameraCommand.List.rawValue,
      ZavorthLocationCommand.Get.rawValue,
      ZavorthMotionCommand.Activity.rawValue,
      ZavorthMotionCommand.Pedometer.rawValue,
      ZavorthSmsCommand.Send.rawValue,
      ZavorthSmsCommand.Search.rawValue,
      ZavorthCallLogCommand.Search.rawValue,
      ZavorthPhotosCommand.Latest.rawValue,
    )

  private val debugCommands = setOf("debug.logs", "debug.ed25519")

  @Test
  fun advertisedCapabilities_respectsFeatureAvailability() {
    val capabilities = InvokeCommandRegistry.advertisedCapabilities(defaultFlags())

    assertContainsAll(capabilities, coreCapabilities)
    assertMissingAll(capabilities, optionalCapabilities)
  }

  @Test
  fun advertisedCapabilities_includesFeatureCapabilitiesWhenEnabled() {
    val capabilities =
      InvokeCommandRegistry.advertisedCapabilities(
        defaultFlags(
          cameraEnabled = true,
          locationEnabled = true,
          sendSmsAvailable = true,
          readSmsAvailable = true,
          smsSearchPossible = true,
          callLogAvailable = true,
          photosAvailable = true,
          voiceWakeEnabled = true,
          motionActivityAvailable = true,
          motionPedometerAvailable = true,
        ),
      )

    assertContainsAll(capabilities, coreCapabilities + optionalCapabilities)
  }

  @Test
  fun advertisedCommands_respectsFeatureAvailability() {
    val commands = InvokeCommandRegistry.advertisedCommands(defaultFlags())

    assertContainsAll(commands, coreCommands)
    assertMissingAll(commands, optionalCommands + debugCommands)
  }

  @Test
  fun advertisedCommands_includesDeviceAppsOnlyWhenUserOptedIn() {
    val disabled = InvokeCommandRegistry.advertisedCommands(defaultFlags(installedAppsSharingEnabled = false))
    val enabled = InvokeCommandRegistry.advertisedCommands(defaultFlags(installedAppsSharingEnabled = true))

    assertFalse(disabled.contains(ZavorthDeviceCommand.Apps.rawValue))
    assertTrue(enabled.contains(ZavorthDeviceCommand.Apps.rawValue))
  }

  @Test
  fun advertisedCommands_includesFeatureCommandsWhenEnabled() {
    val commands =
      InvokeCommandRegistry.advertisedCommands(
        defaultFlags(
          cameraEnabled = true,
          locationEnabled = true,
          sendSmsAvailable = true,
          readSmsAvailable = true,
          smsSearchPossible = true,
          callLogAvailable = true,
          photosAvailable = true,
          motionActivityAvailable = true,
          motionPedometerAvailable = true,
          debugBuild = true,
        ),
      )

    assertContainsAll(commands, coreCommands + optionalCommands + debugCommands)
  }

  @Test
  fun advertisedCommands_onlyIncludesSupportedMotionCommands() {
    val commands =
      InvokeCommandRegistry.advertisedCommands(
        NodeRuntimeFlags(
          cameraEnabled = false,
          locationEnabled = false,
          sendSmsAvailable = false,
          readSmsAvailable = false,
          smsSearchPossible = false,
          callLogAvailable = false,
          photosAvailable = false,
          voiceWakeEnabled = false,
          motionActivityAvailable = true,
          motionPedometerAvailable = false,
          installedAppsSharingEnabled = false,
          debugBuild = false,
        ),
      )

    assertTrue(commands.contains(ZavorthMotionCommand.Activity.rawValue))
    assertFalse(commands.contains(ZavorthMotionCommand.Pedometer.rawValue))
  }

  @Test
  fun advertisedCommands_splitsSmsSendAndSearchAvailability() {
    val readOnlyCommands =
      InvokeCommandRegistry.advertisedCommands(
        defaultFlags(readSmsAvailable = true, smsSearchPossible = true),
      )
    val sendOnlyCommands =
      InvokeCommandRegistry.advertisedCommands(
        defaultFlags(sendSmsAvailable = true),
      )
    val requestableSearchCommands =
      InvokeCommandRegistry.advertisedCommands(
        defaultFlags(smsSearchPossible = true),
      )

    assertTrue(readOnlyCommands.contains(ZavorthSmsCommand.Search.rawValue))
    assertFalse(readOnlyCommands.contains(ZavorthSmsCommand.Send.rawValue))
    assertTrue(sendOnlyCommands.contains(ZavorthSmsCommand.Send.rawValue))
    assertFalse(sendOnlyCommands.contains(ZavorthSmsCommand.Search.rawValue))
    assertTrue(requestableSearchCommands.contains(ZavorthSmsCommand.Search.rawValue))
  }

  @Test
  fun advertisedCapabilities_includeSmsWhenEitherSmsPathIsAvailable() {
    val readOnlyCapabilities =
      InvokeCommandRegistry.advertisedCapabilities(
        defaultFlags(readSmsAvailable = true),
      )
    val sendOnlyCapabilities =
      InvokeCommandRegistry.advertisedCapabilities(
        defaultFlags(sendSmsAvailable = true),
      )
    val requestableSearchCapabilities =
      InvokeCommandRegistry.advertisedCapabilities(
        defaultFlags(smsSearchPossible = true),
      )

    assertTrue(readOnlyCapabilities.contains(ZavorthCapability.Sms.rawValue))
    assertTrue(sendOnlyCapabilities.contains(ZavorthCapability.Sms.rawValue))
    assertFalse(requestableSearchCapabilities.contains(ZavorthCapability.Sms.rawValue))
  }

  @Test
  fun advertisedCommands_excludesCallLogWhenUnavailable() {
    val commands = InvokeCommandRegistry.advertisedCommands(defaultFlags(callLogAvailable = false))

    assertFalse(commands.contains(ZavorthCallLogCommand.Search.rawValue))
  }

  @Test
  fun advertisedCapabilities_excludesCallLogWhenUnavailable() {
    val capabilities = InvokeCommandRegistry.advertisedCapabilities(defaultFlags(callLogAvailable = false))

    assertFalse(capabilities.contains(ZavorthCapability.CallLog.rawValue))
  }

  @Test
  fun advertisedPhotosSurface_respectsFeatureAvailability() {
    val disabledFlags = defaultFlags(photosAvailable = false)
    val enabledFlags = defaultFlags(photosAvailable = true)

    assertFalse(InvokeCommandRegistry.advertisedCapabilities(disabledFlags).contains(ZavorthCapability.Photos.rawValue))
    assertFalse(InvokeCommandRegistry.advertisedCommands(disabledFlags).contains(ZavorthPhotosCommand.Latest.rawValue))
    assertTrue(InvokeCommandRegistry.advertisedCapabilities(enabledFlags).contains(ZavorthCapability.Photos.rawValue))
    assertTrue(InvokeCommandRegistry.advertisedCommands(enabledFlags).contains(ZavorthPhotosCommand.Latest.rawValue))
  }

  @Test
  fun advertisedCapabilities_includesVoiceWakeWithoutAdvertisingCommands() {
    val capabilities = InvokeCommandRegistry.advertisedCapabilities(defaultFlags(voiceWakeEnabled = true))
    val commands = InvokeCommandRegistry.advertisedCommands(defaultFlags(voiceWakeEnabled = true))

    assertTrue(capabilities.contains(ZavorthCapability.VoiceWake.rawValue))
    assertFalse(commands.any { it.contains("voice", ignoreCase = true) })
  }

  @Test
  fun find_returnsForegroundMetadataForCameraCommands() {
    val list = InvokeCommandRegistry.find(ZavorthCameraCommand.List.rawValue)
    val location = InvokeCommandRegistry.find(ZavorthLocationCommand.Get.rawValue)

    assertNotNull(list)
    assertEquals(true, list?.requiresForeground)
    assertNotNull(location)
    assertEquals(false, location?.requiresForeground)
  }

  @Test
  fun find_returnsNullForUnknownCommand() {
    assertNull(InvokeCommandRegistry.find("not.real"))
  }

  private fun defaultFlags(
    cameraEnabled: Boolean = false,
    locationEnabled: Boolean = false,
    sendSmsAvailable: Boolean = false,
    readSmsAvailable: Boolean = false,
    smsSearchPossible: Boolean = false,
    callLogAvailable: Boolean = false,
    photosAvailable: Boolean = false,
    voiceWakeEnabled: Boolean = false,
    motionActivityAvailable: Boolean = false,
    motionPedometerAvailable: Boolean = false,
    installedAppsSharingEnabled: Boolean = false,
    debugBuild: Boolean = false,
  ): NodeRuntimeFlags =
    NodeRuntimeFlags(
      cameraEnabled = cameraEnabled,
      locationEnabled = locationEnabled,
      sendSmsAvailable = sendSmsAvailable,
      readSmsAvailable = readSmsAvailable,
      smsSearchPossible = smsSearchPossible,
      callLogAvailable = callLogAvailable,
      photosAvailable = photosAvailable,
      voiceWakeEnabled = voiceWakeEnabled,
      motionActivityAvailable = motionActivityAvailable,
      motionPedometerAvailable = motionPedometerAvailable,
      installedAppsSharingEnabled = installedAppsSharingEnabled,
      debugBuild = debugBuild,
    )

  private fun assertContainsAll(
    actual: List<String>,
    expected: Set<String>,
  ) {
    expected.forEach { value -> assertTrue(actual.contains(value)) }
  }

  private fun assertMissingAll(
    actual: List<String>,
    forbidden: Set<String>,
  ) {
    forbidden.forEach { value -> assertFalse(actual.contains(value)) }
  }
}
