package mn.khotol.smsrelay

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony

/**
 * SMS_RECEIVED. Зөвхөн тохируулсан банкны илгээгчийн SMS-ийг дараалалд
 * хийнэ — бусад SMS (хувийн, OTP) утаснаас ГАРАХГҮЙ, хадгалагдахгүй.
 *
 * Илгээгчийг SmsMessage.originatingAddress-ээс (сүлжээний TP-OA) уншина,
 * displayOriginatingAddress биш. 131888 shortcode-ийг Samsung/Lime eSIM
 * дээр яг ямар хэлбэрээр өгдгийг бодит утсан дээр шалгах ёстой (README).
 */
class SmsReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return
        val parts = Telephony.Sms.Intents.getMessagesFromIntent(intent)?.filterNotNull().orEmpty()
        if (parts.isEmpty()) return

        val pending = goAsync()
        Thread {
            try {
                val config = RelayConfig(context)
                val allowed = config.allowedSenders
                // Олон хэсэгтэй (multipart) SMS-ийг илгээгчээр нь нийлүүлнэ
                parts.groupBy { it.originatingAddress.orEmpty() }.forEach { (sender, msgs) ->
                    if (!SmsFilter.isAllowedSender(sender, allowed)) {
                        // Shortcode хэрхэн ирж байгааг оношлоход: зөвхөн дугаар, текстгүй, утсан дээрээ
                        config.lastIgnoredSender = SmsFilter.diagnosticSender(sender)
                        return@forEach
                    }
                    val body = msgs.joinToString("") { it.messageBody.orEmpty() }
                    if (body.isBlank() || SmsFilter.isSecretCode(body)) return@forEach
                    val ts = msgs.first().timestampMillis
                    Outbox(context).enqueue(SmsFilter.messageId(sender, body, ts), sender, body, ts)
                    config.lastSmsAt = System.currentTimeMillis()
                }
                DeliveryWorker.enqueue(context)
            } finally {
                pending.finish()
            }
        }.start()
    }
}
