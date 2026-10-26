package mn.khotol.smsrelay

import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.time.Instant

/** Хотолын /api/bank-sms-тэй ярина. Зөвхөн HTTPS. */
class ApiClient(private val baseUrl: String, private val token: String) {

    data class Response(val code: Int, val json: JSONObject?)

    init {
        require(SmsFilter.isHttpsUrl(baseUrl)) { "Зөвхөн https:// хаяг" }
    }

    fun sendSms(item: Outbox.Item): SendResult = request("POST", JSONObject().apply {
        put("schemaVersion", 1)
        put("messageId", item.id)
        put("sender", item.sender)
        put("body", item.body)
        put("receivedAt", Instant.ofEpochMilli(item.receivedAt).toString())
    }).let { SendResult(it.code, it.json?.optBoolean("accepted") == true, it.json?.optString("error")) }

    fun heartbeat(pending: Int, failed: Int, lastSmsAt: Long, lastDeliveryAt: Long): Response =
        request("POST", JSONObject().apply {
            put("schemaVersion", 1)
            put("type", "heartbeat")
            put("pending", pending)
            put("failed", failed)
            if (lastSmsAt > 0) put("lastSmsAt", Instant.ofEpochMilli(lastSmsAt).toString())
            if (lastDeliveryAt > 0) put("lastDeliveryAt", Instant.ofEpochMilli(lastDeliveryAt).toString())
            put("appVersion", BuildConfig.VERSION_NAME)
        })

    fun ping(): Response = request("GET", null)

    @Throws(IOException::class)
    private fun request(method: String, body: JSONObject?): Response {
        val conn = URL("$baseUrl/api/bank-sms").openConnection() as HttpURLConnection
        try {
            conn.requestMethod = method
            conn.connectTimeout = 15_000
            conn.readTimeout = 20_000
            conn.instanceFollowRedirects = false // токеныг өөр хост руу дамжуулахгүй
            conn.setRequestProperty("Authorization", "Bearer $token")
            conn.setRequestProperty("Accept", "application/json")
            if (body != null) {
                val bytes = body.toString().toByteArray(Charsets.UTF_8)
                conn.doOutput = true
                conn.setRequestProperty("Content-Type", "application/json; charset=utf-8")
                conn.setFixedLengthStreamingMode(bytes.size)
                conn.outputStream.use { it.write(bytes) }
            }
            val code = conn.responseCode
            val stream = if (code in 200..299) conn.inputStream else conn.errorStream
            val text = stream?.bufferedReader()?.use { it.readText().take(4000) }
            val json = try { text?.let { JSONObject(it) } } catch (e: Exception) { null }
            return Response(code, json)
        } finally {
            conn.disconnect()
        }
    }
}
