package mn.khotol.smsrelay

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import java.io.IOException
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Энэ аппын ЦОР ГАНЦ зориулалт: СӨХ-ийн дансны банкны SMS-ийг Хотол руу
 * дамжуулах. Дэлгэц нь тохиргоо + төлөвийг харуулна.
 */
class MainActivity : AppCompatActivity() {

    private lateinit var config: RelayConfig
    private lateinit var outbox: Outbox

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        config = RelayConfig(this)
        outbox = Outbox(this)

        val url = findViewById<EditText>(R.id.serverUrl)
        val token = findViewById<EditText>(R.id.token)
        val senders = findViewById<EditText>(R.id.senders)
        url.setText(config.serverUrl)
        senders.setText(config.allowedSenders.joinToString(", "))
        if (config.hasToken) token.hint = getString(R.string.token_saved_hint)

        findViewById<Button>(R.id.save).setOnClickListener {
            val u = url.text.toString().trim().trimEnd('/')
            if (!SmsFilter.isHttpsUrl(u)) return@setOnClickListener toast("Хаяг https:// -ээр эхлэх ёстой")
            val s = SmsFilter.parseSenders(senders.text.toString())
            if (s.isEmpty()) return@setOnClickListener toast("Банкны SMS илгээгчийн дугаараа оруулна уу")
            config.serverUrl = u
            config.allowedSenders = s
            val t = token.text.toString().trim()
            if (t.isNotEmpty()) {
                if (!t.startsWith("khsms_")) return@setOnClickListener toast("Токен khsms_ -ээр эхэлнэ")
                config.saveToken(t)
                token.setText("")
                token.hint = getString(R.string.token_saved_hint)
            }
            DeliveryWorker.schedulePeriodic(this)
            DeliveryWorker.enqueue(this)
            toast("Хадгаллаа")
            refresh()
        }

        findViewById<Button>(R.id.permission).setOnClickListener {
            requestPermissions(arrayOf(Manifest.permission.RECEIVE_SMS), 1)
        }

        findViewById<Button>(R.id.battery).setOnClickListener {
            // Зөвшөөрөл шаарддаггүй жагсаалт руу илгээнэ — хэрэглэгч өөрөө сонгоно
            startActivity(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS))
        }

        findViewById<Button>(R.id.test).setOnClickListener { testConnection() }

        findViewById<Button>(R.id.sendNow).setOnClickListener {
            DeliveryWorker.enqueue(this)
            toast("Илгээх ажлыг эхлүүллээ")
        }
    }

    override fun onResume() {
        super.onResume()
        if (config.isConfigured) DeliveryWorker.schedulePeriodic(this)
        refresh()
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        refresh()
    }

    private fun testConnection() {
        val t = config.token() ?: return toast("Эхлээд токеноо хадгална уу")
        if (!SmsFilter.isHttpsUrl(config.serverUrl)) return toast("Серверийн хаяг буруу")
        Thread {
            val msg = try {
                val r = ApiClient(config.serverUrl, t).ping()
                when (r.code) {
                    200 -> {
                        config.authBlocked = false
                        "✓ Холбогдлоо: ${r.json?.optString("device")}"
                    }
                    401 -> "Токен буруу (401)"
                    403 -> "Төхөөрөмж цуцлагдсан (403)"
                    else -> "Сервер: HTTP ${r.code}"
                }
            } catch (e: IOException) {
                "Сүлжээ: ${e.javaClass.simpleName}"
            }
            runOnUiThread { toast(msg); refresh() }
        }.start()
    }

    private fun refresh() {
        val fmt = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US)
        fun at(ms: Long) = if (ms > 0) fmt.format(Date(ms)) else "—"
        val smsGranted = ContextCompat.checkSelfPermission(this, Manifest.permission.RECEIVE_SMS) == PackageManager.PERMISSION_GRANTED
        val battery = (getSystemService(POWER_SERVICE) as PowerManager).isIgnoringBatteryOptimizations(packageName)
        Thread {
            val pending = outbox.count("pending")
            val rejected = outbox.count("rejected")
            val delivered = outbox.count("delivered")
            val text = buildString {
                appendLine(if (config.isConfigured && smsGranted && !config.authBlocked) "● Ажиллаж байна" else "● ТОХИРГОО ДУТУУ")
                appendLine("SMS зөвшөөрөл: ${if (smsGranted) "өгсөн" else "ӨГӨӨГҮЙ"}")
                appendLine("Батарей хязгаарлалт: ${if (battery) "чөлөөлсөн" else "ИДЭВХТЭЙ — чөлөөлнө үү"}")
                appendLine("Токен: ${if (config.hasToken) "хадгалсан" else "алга"}${if (config.authBlocked) " (сервер хүлээж авсангүй)" else ""}")
                appendLine("Илгээгч: ${config.allowedSenders.joinToString().ifEmpty { "—" }}")
                appendLine()
                appendLine("Сүүлд SMS хүлээн авсан: ${at(config.lastSmsAt)}")
                appendLine("Сүүлд амжилттай дамжуулсан: ${at(config.lastDeliveryAt)}")
                appendLine("Дараалалд хүлээгдэж буй: $pending")
                appendLine("Дамжуулсан (14 хоног): $delivered · Татгалзсан: $rejected")
                config.lastError?.let { appendLine("Сүүлийн алдаа (${at(config.lastErrorAt)}): $it") }
                config.lastIgnoredSender?.let { appendLine("Сүүлд шүүгдсэн илгээгч: $it") }
            }
            runOnUiThread { findViewById<TextView>(R.id.status).text = text }
        }.start()
    }

    private fun toast(s: String) = Toast.makeText(this, s, Toast.LENGTH_LONG).show()
}
