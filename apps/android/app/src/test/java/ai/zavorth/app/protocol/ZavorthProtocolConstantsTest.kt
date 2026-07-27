package dev.zavorth.companion.protocol

import org.junit.Assert.assertEquals
import org.junit.Test

class ZavorthProtocolConstantsTest {
  @Test
  fun canvasCommandsUseStableStrings() {
    assertEquals("canvas.present", ZavorthCanvasCommand.Present.rawValue)
    assertEquals("canvas.hide", ZavorthCanvasCommand.Hide.rawValue)
    assertEquals("canvas.navigate", ZavorthCanvasCommand.Navigate.rawValue)
    assertEquals("canvas.eval", ZavorthCanvasCommand.Eval.rawValue)
    assertEquals("canvas.snapshot", ZavorthCanvasCommand.Snapshot.rawValue)
  }

  @Test
  fun a2uiCommandsUseStableStrings() {
    assertEquals("canvas.a2ui.push", ZavorthCanvasA2UICommand.Push.rawValue)
    assertEquals("canvas.a2ui.pushJSONL", ZavorthCanvasA2UICommand.PushJSONL.rawValue)
    assertEquals("canvas.a2ui.reset", ZavorthCanvasA2UICommand.Reset.rawValue)
  }

  @Test
  fun capabilitiesUseStableStrings() {
    assertEquals("canvas", ZavorthCapability.Canvas.rawValue)
    assertEquals("camera", ZavorthCapability.Camera.rawValue)
    assertEquals("voiceWake", ZavorthCapability.VoiceWake.rawValue)
    assertEquals("talk", ZavorthCapability.Talk.rawValue)
    assertEquals("location", ZavorthCapability.Location.rawValue)
    assertEquals("sms", ZavorthCapability.Sms.rawValue)
    assertEquals("device", ZavorthCapability.Device.rawValue)
    assertEquals("notifications", ZavorthCapability.Notifications.rawValue)
    assertEquals("system", ZavorthCapability.System.rawValue)
    assertEquals("photos", ZavorthCapability.Photos.rawValue)
    assertEquals("contacts", ZavorthCapability.Contacts.rawValue)
    assertEquals("calendar", ZavorthCapability.Calendar.rawValue)
    assertEquals("motion", ZavorthCapability.Motion.rawValue)
    assertEquals("callLog", ZavorthCapability.CallLog.rawValue)
  }

  @Test
  fun cameraCommandsUseStableStrings() {
    assertEquals("camera.list", ZavorthCameraCommand.List.rawValue)
    assertEquals("camera.snap", ZavorthCameraCommand.Snap.rawValue)
    assertEquals("camera.clip", ZavorthCameraCommand.Clip.rawValue)
  }

  @Test
  fun notificationsCommandsUseStableStrings() {
    assertEquals("notifications.list", ZavorthNotificationsCommand.List.rawValue)
    assertEquals("notifications.actions", ZavorthNotificationsCommand.Actions.rawValue)
  }

  @Test
  fun deviceCommandsUseStableStrings() {
    assertEquals("device.status", ZavorthDeviceCommand.Status.rawValue)
    assertEquals("device.info", ZavorthDeviceCommand.Info.rawValue)
    assertEquals("device.permissions", ZavorthDeviceCommand.Permissions.rawValue)
    assertEquals("device.health", ZavorthDeviceCommand.Health.rawValue)
    assertEquals("device.apps", ZavorthDeviceCommand.Apps.rawValue)
  }

  @Test
  fun systemCommandsUseStableStrings() {
    assertEquals("system.notify", ZavorthSystemCommand.Notify.rawValue)
  }

  @Test
  fun photosCommandsUseStableStrings() {
    assertEquals("photos.latest", ZavorthPhotosCommand.Latest.rawValue)
  }

  @Test
  fun contactsCommandsUseStableStrings() {
    assertEquals("contacts.search", ZavorthContactsCommand.Search.rawValue)
    assertEquals("contacts.add", ZavorthContactsCommand.Add.rawValue)
  }

  @Test
  fun calendarCommandsUseStableStrings() {
    assertEquals("calendar.events", ZavorthCalendarCommand.Events.rawValue)
    assertEquals("calendar.add", ZavorthCalendarCommand.Add.rawValue)
  }

  @Test
  fun motionCommandsUseStableStrings() {
    assertEquals("motion.activity", ZavorthMotionCommand.Activity.rawValue)
    assertEquals("motion.pedometer", ZavorthMotionCommand.Pedometer.rawValue)
  }

  @Test
  fun smsCommandsUseStableStrings() {
    assertEquals("sms.send", ZavorthSmsCommand.Send.rawValue)
    assertEquals("sms.search", ZavorthSmsCommand.Search.rawValue)
  }

  @Test
  fun talkCommandsUseStableStrings() {
    assertEquals("talk.ptt.start", ZavorthTalkCommand.PttStart.rawValue)
    assertEquals("talk.ptt.stop", ZavorthTalkCommand.PttStop.rawValue)
    assertEquals("talk.ptt.cancel", ZavorthTalkCommand.PttCancel.rawValue)
    assertEquals("talk.ptt.once", ZavorthTalkCommand.PttOnce.rawValue)
  }

  @Test
  fun callLogCommandsUseStableStrings() {
    assertEquals("callLog.search", ZavorthCallLogCommand.Search.rawValue)
  }
}
