package mn.khotol.smsrelay

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper

/**
 * Локал дараалал (SQLite). SMS ирмэгц энд бичигдэнэ, сервер 2xx + accepted
 * буцаасны ДАРАА л 'delivered' болно. Интернет тасарсан, утас унтарсан ч
 * алдагдахгүй. Хүргэгдсэн SMS-ийн текстийг шууд арилгана (хувийн мэдээлэл).
 */
class Outbox(context: Context) : SQLiteOpenHelper(context.applicationContext, "outbox.db", null, 1) {

    data class Item(val id: String, val sender: String, val body: String, val receivedAt: Long, val attempts: Int)

    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL(
            """CREATE TABLE outbox (
                id TEXT PRIMARY KEY,
                sender TEXT NOT NULL,
                body TEXT,
                received_at INTEGER NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                attempts INTEGER NOT NULL DEFAULT 0,
                last_error TEXT,
                created_at INTEGER NOT NULL,
                done_at INTEGER
            )""",
        )
        db.execSQL("CREATE INDEX outbox_status ON outbox(status, received_at)")
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) = Unit

    /** Ижил ID (broadcast давхардсан) бол юу ч хийхгүй. */
    fun enqueue(id: String, sender: String, body: String, receivedAt: Long): Boolean {
        val v = ContentValues().apply {
            put("id", id); put("sender", sender); put("body", body)
            put("received_at", receivedAt); put("created_at", System.currentTimeMillis())
        }
        return writableDatabase.insertWithOnConflict("outbox", null, v, SQLiteDatabase.CONFLICT_IGNORE) != -1L
    }

    fun pending(limit: Int): List<Item> =
        readableDatabase.rawQuery(
            "SELECT id, sender, body, received_at, attempts FROM outbox WHERE status = 'pending' ORDER BY received_at LIMIT ?",
            arrayOf(limit.toString()),
        ).use { c ->
            buildList { while (c.moveToNext()) add(Item(c.getString(0), c.getString(1), c.getString(2) ?: "", c.getLong(3), c.getInt(4))) }
        }

    fun markDelivered(id: String) = finish(id, "delivered", null)

    /** Сервер payload-ийг хүлээж авахгүй (4xx) — дахин илгээхгүй. */
    fun markRejected(id: String, error: String) = finish(id, "rejected", error)

    private fun finish(id: String, status: String, error: String?) {
        writableDatabase.update(
            "outbox",
            ContentValues().apply {
                put("status", status); put("last_error", error); put("done_at", System.currentTimeMillis())
                putNull("body")
            },
            "id = ?", arrayOf(id),
        )
    }

    fun recordFailure(id: String, error: String) {
        writableDatabase.execSQL(
            "UPDATE outbox SET attempts = attempts + 1, last_error = ? WHERE id = ?",
            arrayOf(error.take(200), id),
        )
    }

    fun count(status: String): Int =
        readableDatabase.rawQuery("SELECT COUNT(*) FROM outbox WHERE status = ?", arrayOf(status))
            .use { c -> if (c.moveToFirst()) c.getInt(0) else 0 }

    /** Дууссан мөрийн мета өгөгдлийг 14 хоногийн дараа устгана. */
    fun cleanup() {
        val cutoff = System.currentTimeMillis() - 14L * 24 * 3600 * 1000
        writableDatabase.delete("outbox", "status != 'pending' AND done_at < ?", arrayOf(cutoff.toString()))
    }
}
