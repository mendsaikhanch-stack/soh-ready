package mn.khotol.smsrelay

/**
 * Дараалал — Outbox (SQLite) үүнийг хэрэгжүүлнэ; unit test-д санах ойн
 * хувилбар ашиглана. Android-оос хамааралгүй.
 */
interface DeliveryQueue {
    /** Ижил ID аль хэдийн байвал юу ч хийхгүй, false буцаана. */
    fun enqueue(id: String, sender: String, body: String, receivedAt: Long): Boolean
    fun pending(limit: Int): List<Outbox.Item>
    fun markDelivered(id: String)
    fun markRejected(id: String, error: String)
    fun recordFailure(id: String, error: String)
}

/** Серверийн хариуны JSON-оос хамааралгүй хураангуй (org.json нь JVM test-д ажилладаггүй). */
data class SendResult(val code: Int, val accepted: Boolean, val error: String?)

/**
 * Дараалалд байгаа SMS-ийг ээлжээр илгээнэ.
 *   2xx + accepted   → delivered (текстийг утаснаас арилгана)
 *   400/413/422      → rejected (дахин илгээхгүй — payload буруу)
 *   401/403          → токен буруу/цуцлагдсан: зогсож, тохиргоо засахыг хүлээнэ
 *   2xx accepted=false, 429/5xx, сүлжээ → дараа дахин оролдоно
 * Сүлжээний алдаа (IOException) дуудагч руу гарна — WorkManager retry хийнэ.
 */
class DeliveryProcessor(
    private val queue: DeliveryQueue,
    private val send: (Outbox.Item) -> SendResult,
    private val batchSize: Int = 20,
) {
    enum class Stop { DRAINED, AUTH_BLOCKED, RETRY_LATER }

    data class Outcome(val stop: Stop, val delivered: Int, val rejected: Int, val lastError: String?)

    fun run(): Outcome {
        var delivered = 0
        var rejected = 0
        var lastError: String? = null
        val seen = HashSet<String>()
        while (true) {
            // Энэ ажлын явцад дахин pending болсон мөрийг давтахгүй (хязгааргүй давталтаас хамгаална)
            val batch = queue.pending(batchSize).filter { seen.add(it.id) }
            if (batch.isEmpty()) return Outcome(Stop.DRAINED, delivered, rejected, lastError)
            for (item in batch) {
                val res = send(item)
                when {
                    res.code in 200..299 && res.accepted -> {
                        queue.markDelivered(item.id)
                        delivered++
                    }
                    res.code == 401 || res.code == 403 -> {
                        lastError = "Сервер токеныг хүлээж авсангүй (${res.code}) — токеноо шинэчилнэ үү"
                        return Outcome(Stop.AUTH_BLOCKED, delivered, rejected, lastError)
                    }
                    res.code == 400 || res.code == 413 || res.code == 422 -> {
                        val err = sanitize(res.error)
                        queue.markRejected(item.id, "HTTP ${res.code} $err".trim())
                        rejected++
                        lastError = "SMS татгалзсан: $err"
                    }
                    else -> {
                        queue.recordFailure(item.id, "HTTP ${res.code}")
                        lastError = "Сервер түр алдаатай (${res.code})"
                        return Outcome(Stop.RETRY_LATER, delivered, rejected, lastError)
                    }
                }
            }
        }
    }

    companion object {
        /** Серверийн алдааны код (invalid_body г.м.) л үлдээнэ — SMS-ийн текст, дүн дэлгэцэд гарахгүй. */
        fun sanitize(error: String?): String =
            error.orEmpty().filter { it in 'a'..'z' || it == '_' }.take(60)
    }
}
