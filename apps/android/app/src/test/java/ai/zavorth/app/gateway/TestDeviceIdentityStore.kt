package dev.zavorth.companion.gateway

import android.content.Context
import java.io.File

internal fun testDeviceIdentityStore(
  context: Context,
  namespace: String = "default",
): DeviceIdentityStore {
  val appContext = context.applicationContext
  val normalizedNamespace = namespace.replace(Regex("[^A-Za-z0-9._-]"), "_")
  return DeviceIdentityStore(
    context = appContext,
    identityFileOverride = File(appContext.filesDir, "test-device-identity/$normalizedNamespace/device.json"),
    securePrefsOverride =
      appContext.getSharedPreferences(
        "test-device-identity.$normalizedNamespace",
        Context.MODE_PRIVATE,
      ),
  )
}
