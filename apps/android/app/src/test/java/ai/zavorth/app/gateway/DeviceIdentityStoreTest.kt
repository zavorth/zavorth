package dev.zavorth.companion.gateway

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import java.io.File
import java.util.UUID

@RunWith(RobolectricTestRunner::class)
class DeviceIdentityStoreTest {
  @Test
  fun persistsOnlyPublicIdentityMetadataInTheFile() {
    val fixture = fixture()
    val identity = fixture.store.loadOrCreate()

    val persisted = fixture.identityFile.readText(Charsets.UTF_8)
    assertFalse(persisted.contains("privateKeyPkcs8Base64"))
    assertFalse(persisted.contains(identity.privateKeyPkcs8Base64))
    assertEquals(identity.privateKeyPkcs8Base64, fixture.securePrefs.getString(privateKeyPref, null))

    val reloaded = DeviceIdentityStore(fixture.context, fixture.identityFile, fixture.securePrefs).loadOrCreate()
    assertEquals(identity, reloaded)
    val signature = fixture.store.signPayload("zavorth-device-identity", identity)
    assertNotNull(signature)
    assertTrue(fixture.store.verifySelfSignature("zavorth-device-identity", checkNotNull(signature), identity))
  }

  @Test
  fun migratesLegacyPrivateKeyOutOfTheIdentityFile() {
    val source = fixture()
    val identity = source.store.loadOrCreate()
    val legacyFixture = fixture()
    legacyFixture.identityFile.parentFile?.mkdirs()
    legacyFixture.identityFile.writeText(
      Json.encodeToString(DeviceIdentity.serializer(), identity),
      Charsets.UTF_8,
    )

    val migrated = legacyFixture.store.loadOrCreate()

    assertEquals(identity, migrated)
    val persisted = legacyFixture.identityFile.readText(Charsets.UTF_8)
    assertFalse(persisted.contains("privateKeyPkcs8Base64"))
    assertFalse(persisted.contains(identity.privateKeyPkcs8Base64))
    assertEquals(identity.privateKeyPkcs8Base64, legacyFixture.securePrefs.getString(privateKeyPref, null))
  }

  private fun fixture(): Fixture {
    val context = ApplicationProvider.getApplicationContext<Context>()
    val id = UUID.randomUUID().toString()
    val identityFile = File(context.cacheDir, "device-identity-tests/$id/device.json")
    val securePrefs = context.getSharedPreferences("device-identity-test-$id", Context.MODE_PRIVATE)
    securePrefs.edit().clear().commit()
    return Fixture(
      context = context,
      identityFile = identityFile,
      securePrefs = securePrefs,
      store = DeviceIdentityStore(context, identityFile, securePrefs),
    )
  }

  private data class Fixture(
    val context: Context,
    val identityFile: File,
    val securePrefs: android.content.SharedPreferences,
    val store: DeviceIdentityStore,
  )

  companion object {
    private const val privateKeyPref = "deviceIdentity.privateKeyPkcs8Base64"
  }
}
