package mn.khotol.smsrelay

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * Тохиргоо. Төхөөрөмжийн токеныг Android Keystore-ийн AES-GCM түлхүүрээр
 * шифрлэж хадгална — түлхүүр нь утаснаас гаргах боломжгүй (hardware-backed
 * байж болно), backup-д орохгүй (allowBackup=false). Токен эх кодод байхгүй.
 */
class RelayConfig(context: Context) {
    private val prefs = context.applicationContext.getSharedPreferences("relay", Context.MODE_PRIVATE)

    var serverUrl: String
        get() = prefs.getString("server_url", "") ?: ""
        set(v) = prefs.edit().putString("server_url", v.trim().trimEnd('/')).apply()

    var allowedSenders: List<String>
        get() = SmsFilter.parseSenders(prefs.getString("senders", "") ?: "")
        set(v) = prefs.edit().putString("senders", v.joinToString(",")).apply()

    var lastSmsAt: Long
        get() = prefs.getLong("last_sms_at", 0)
        set(v) = prefs.edit().putLong("last_sms_at", v).apply()

    var lastDeliveryAt: Long
        get() = prefs.getLong("last_delivery_at", 0)
        set(v) = prefs.edit().putLong("last_delivery_at", v).apply()

    var lastError: String?
        get() = prefs.getString("last_error", null)
        set(v) = prefs.edit().putString("last_error", v).putLong("last_error_at", System.currentTimeMillis()).apply()

    val lastErrorAt: Long get() = prefs.getLong("last_error_at", 0)

    var lastIgnoredSender: String?
        get() = prefs.getString("last_ignored_sender", null)
        set(v) = prefs.edit().putString("last_ignored_sender", v).apply()

    /** 401/403 ирвэл токен засагдах хүртэл илгээхээ зогсооно (хоосон retry хийхгүй). */
    var authBlocked: Boolean
        get() = prefs.getBoolean("auth_blocked", false)
        set(v) = prefs.edit().putBoolean("auth_blocked", v).apply()

    val hasToken: Boolean get() = prefs.contains("token_ct")

    val isConfigured: Boolean
        get() = SmsFilter.isHttpsUrl(serverUrl) && hasToken && allowedSenders.isNotEmpty()

    fun saveToken(token: String) {
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.ENCRYPT_MODE, key())
        val ct = cipher.doFinal(token.trim().toByteArray(Charsets.UTF_8))
        prefs.edit()
            .putString("token_ct", Base64.encodeToString(ct, Base64.NO_WRAP))
            .putString("token_iv", Base64.encodeToString(cipher.iv, Base64.NO_WRAP))
            .putBoolean("auth_blocked", false)
            .apply()
    }

    fun token(): String? {
        val ct = prefs.getString("token_ct", null) ?: return null
        val iv = prefs.getString("token_iv", null) ?: return null
        return try {
            val cipher = Cipher.getInstance(TRANSFORMATION)
            cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, Base64.decode(iv, Base64.NO_WRAP)))
            String(cipher.doFinal(Base64.decode(ct, Base64.NO_WRAP)), Charsets.UTF_8)
        } catch (e: Exception) {
            null // түлхүүр устсан (утас reset г.м.) → токеныг дахин оруулна
        }
    }

    private fun key(): SecretKey {
        val ks = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (ks.getKey(KEY_ALIAS, null) as? SecretKey)?.let { return it }
        val gen = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
        gen.init(
            KeyGenParameterSpec.Builder(KEY_ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build(),
        )
        return gen.generateKey()
    }

    private companion object {
        const val KEY_ALIAS = "khotol_relay_token"
        const val TRANSFORMATION = "AES/GCM/NoPadding"
    }
}
