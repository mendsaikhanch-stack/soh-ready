package mn.khotol.smsrelay

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.IOException

/** Outbox (SQLite)-ийн зан төлөвийг дуурайсан санах ойн дараалал. */
private class FakeQueue : DeliveryQueue {
    data class Row(val item: Outbox.Item, var status: String = "pending", var attempts: Int = 0, var error: String? = null, var body: String? = item.body)

    val rows = LinkedHashMap<String, Row>()

    override fun enqueue(id: String, sender: String, body: String, receivedAt: Long): Boolean {
        if (rows.containsKey(id)) return false // INSERT ... ON CONFLICT IGNORE
        rows[id] = Row(Outbox.Item(id, sender, body, receivedAt, 0))
        return true
    }

    override fun pending(limit: Int): List<Outbox.Item> =
        rows.values.filter { it.status == "pending" }.sortedBy { it.item.receivedAt }.take(limit)
            .map { it.item.copy(attempts = it.attempts) }

    override fun markDelivered(id: String) = finish(id, "delivered", null)
    override fun markRejected(id: String, error: String) = finish(id, "rejected", error)

    private fun finish(id: String, status: String, error: String?) {
        rows.getValue(id).apply { this.status = status; this.error = error; body = null }
    }

    override fun recordFailure(id: String, error: String) {
        rows.getValue(id).apply { attempts++; this.error = error }
    }

    fun status(id: String) = rows.getValue(id).status
}

/** Сервер: messageId-аар давхардлыг арилгадаг (bank_sms_events.message_id UNIQUE-ийг дуурайна). */
private class FakeServer(private val script: MutableList<Int> = mutableListOf()) {
    val received = mutableListOf<String>()
    val stored = LinkedHashSet<String>()

    fun send(item: Outbox.Item): SendResult {
        received += item.id
        val code = if (script.isEmpty()) 200 else script.removeAt(0)
        if (code == -1) throw IOException("offline")
        if (code in 200..299) stored += item.id // давхар ирсэн ч нэг л мөр
        return when (code) {
            in 200..299 -> SendResult(code, true, null)
            422 -> SendResult(code, false, "invalid_body")
            else -> SendResult(code, false, "server_error")
        }
    }
}

class DeliveryProcessorTest {
    private val body = "Таны 5006***029 тоот дансанд 55,000.00MNT ORLOGO орлоо. Uldegdel 61,909.93MNT Ognoo: 2026-10-25; qpay 200000779046929 613toot"

    private fun FakeQueue.add(n: Int, at: Long = 1_000L): String {
        val id = SmsFilter.messageId("131888", "$body #$n", at + n)
        enqueue(id, "131888", "$body #$n", at + n)
        return id
    }

    @Test fun deliversAllAndClearsBody() {
        val q = FakeQueue()
        val ids = (1..3).map { q.add(it) }
        val server = FakeServer()
        val out = DeliveryProcessor(q, server::send).run()

        assertEquals(DeliveryProcessor.Stop.DRAINED, out.stop)
        assertEquals(3, out.delivered)
        assertEquals(ids, server.received) // хүлээн авсан дарааллаар
        ids.forEach { assertEquals("delivered", q.status(it)); assertNull(q.rows.getValue(it).body) }
        assertTrue(q.pending(10).isEmpty())
    }

    @Test fun duplicateBroadcastIsQueuedOnce() {
        val q = FakeQueue()
        val id = SmsFilter.messageId("+131888", body, 42L)
        assertTrue(q.enqueue(id, "+131888", body, 42L))
        // Ижил SMS-ийн broadcast дахин ирэв (илгээгчийн хэлбэр өөр ч ID ижил)
        val again = SmsFilter.messageId("131888", body, 42L)
        assertEquals(id, again)
        assertFalse(q.enqueue(again, "131888", body, 42L))
        assertEquals(1, q.rows.size)
    }

    @Test fun retryAfterLostResponseDoesNotDuplicateOnServer() {
        val q = FakeQueue()
        val id = q.add(1)
        // 1-р оролдлого: сервер хадгалсан ч хариу 503 ирсэн гэж үзье → дараа нь дахин илгээнэ
        val server = FakeServer(mutableListOf(200))
        val flaky: (Outbox.Item) -> SendResult = { item -> server.send(item).let { if (server.received.size == 1) SendResult(503, false, null) else it } }
        val first = DeliveryProcessor(q, flaky).run()
        assertEquals(DeliveryProcessor.Stop.RETRY_LATER, first.stop)
        assertEquals("pending", q.status(id))
        assertEquals(1, q.rows.getValue(id).attempts)

        val second = DeliveryProcessor(q, server::send).run()
        assertEquals(DeliveryProcessor.Stop.DRAINED, second.stop)
        assertEquals("delivered", q.status(id))
        assertEquals(listOf(id, id), server.received) // ижил messageId-аар дахин очсон
        assertEquals(setOf(id), server.stored) // сервер дээр ганц мөр
    }

    @Test fun serverErrorStopsBatchAndKeepsOrder() {
        val q = FakeQueue()
        val ids = (1..3).map { q.add(it) }
        val out = DeliveryProcessor(q, FakeServer(mutableListOf(200, 500))::send).run()

        assertEquals(DeliveryProcessor.Stop.RETRY_LATER, out.stop)
        assertEquals(listOf("delivered", "pending", "pending"), ids.map { q.status(it) })
        assertEquals("Сервер түр алдаатай (500)", out.lastError)
    }

    @Test fun rateLimitIsRetriedNotRejected() {
        val q = FakeQueue()
        val id = q.add(1)
        val out = DeliveryProcessor(q, FakeServer(mutableListOf(429))::send).run()
        assertEquals(DeliveryProcessor.Stop.RETRY_LATER, out.stop)
        assertEquals("pending", q.status(id))
    }

    @Test fun invalidPayloadIsRejectedAndOthersContinue() {
        val q = FakeQueue()
        val ids = (1..2).map { q.add(it) }
        val out = DeliveryProcessor(q, FakeServer(mutableListOf(422, 200))::send).run()

        assertEquals(DeliveryProcessor.Stop.DRAINED, out.stop)
        assertEquals(listOf("rejected", "delivered"), ids.map { q.status(it) })
        assertEquals(1, out.rejected)
        assertNull(q.rows.getValue(ids[0]).body) // татгалзсан SMS-ийн текстийг ч арилгана
    }

    @Test fun authFailureStopsWithoutTouchingQueue() {
        val q = FakeQueue()
        val ids = (1..2).map { q.add(it) }
        val out = DeliveryProcessor(q, FakeServer(mutableListOf(401))::send).run()

        assertEquals(DeliveryProcessor.Stop.AUTH_BLOCKED, out.stop)
        ids.forEach { assertEquals("pending", q.status(it)); assertEquals(0, q.rows.getValue(it).attempts) }
    }

    @Test(expected = IOException::class)
    fun networkErrorPropagatesForWorkManagerRetry() {
        val q = FakeQueue()
        q.add(1)
        DeliveryProcessor(q, FakeServer(mutableListOf(-1))::send).run()
    }

    @Test fun acceptedFalseIsRetriedLater() {
        val q = FakeQueue()
        val id = q.add(1)
        val out = DeliveryProcessor(q, { SendResult(200, false, null) }).run()
        assertEquals(DeliveryProcessor.Stop.RETRY_LATER, out.stop)
        assertEquals("pending", q.status(id))
    }

    @Test fun drainsMoreThanOneBatch() {
        val q = FakeQueue()
        repeat(45) { q.add(it) }
        val out = DeliveryProcessor(q, FakeServer()::send, batchSize = 20).run()
        assertEquals(45, out.delivered)
        assertTrue(q.pending(100).isEmpty())
    }

    @Test fun errorTextIsSanitized() {
        assertEquals("invalid_body", DeliveryProcessor.sanitize("invalid_body"))
        assertEquals("toot", DeliveryProcessor.sanitize("55,000 MNT 613toot"))
        assertEquals(60, DeliveryProcessor.sanitize("x".repeat(500)).length)
        assertEquals("", DeliveryProcessor.sanitize(null))
    }
}
