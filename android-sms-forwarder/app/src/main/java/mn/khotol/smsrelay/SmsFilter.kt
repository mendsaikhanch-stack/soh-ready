package mn.khotol.smsrelay

import java.security.MessageDigest

/**
 * Android-оос хамааралгүй цэвэр дүрмүүд (JVM unit test-ээр шалгагдана).
 * Серверийн app/lib/bank-sms/core.ts-тэй ижил утгатай байх ёстой —
 * сервер ДАХИН шалгадаг тул энэ нь зөвхөн «шаардлагагүй SMS утаснаас
 * гарахгүй» байх эхний хамгаалалт.
 */
object SmsFilter {

    /** «+131888», «131 888» → «131888». Үсэгтэй нэрийг том үсгээр. */
    fun normalizeSender(raw: String?): String {
        val t = raw?.trim().orEmpty()
        if (t.isEmpty()) return ""
        return if (t.all { it.isDigit() || it in "+ ()-" }) t.filter { it.isDigit() }
        else t.uppercase().replace(Regex("\\s+"), "")
    }

    /** Тохиргоонд байхгүй илгээгчийн SMS-ийг огт хадгалахгүй, дамжуулахгүй. */
    fun isAllowedSender(sender: String?, allowed: List<String>): Boolean {
        val n = normalizeSender(sender)
        return n.isNotEmpty() && allowed.any { normalizeSender(it) == n }
    }

    fun parseSenders(text: String): List<String> =
        text.split(Regex("[,;\\s]+")).map { it.trim() }.filter { it.isNotEmpty() }.distinct().take(5)

    private val CREDIT = Regex("(ORLOGO|орлого)\\s+(орлоо|orloo)", RegexOption.IGNORE_CASE)
    private val SECRET = Regex(
        "(OTP|нууц\\s*код|баталгаажуулах\\s*код|нэг\\s*удаагийн|verification|passcode|(?<!\\p{L})(code|код|kod)(?!\\p{L}))",
        RegexOption.IGNORE_CASE,
    )

    fun looksLikeCredit(body: String): Boolean = CREDIT.containsMatchIn(body)

    /** OTP / нэвтрэх код мэт, гүйлгээ биш SMS → дамжуулахгүй. */
    fun isSecretCode(body: String): Boolean = SECRET.containsMatchIn(body) && !looksLikeCredit(body)

    /**
     * Тогтвортой ID: ижил SMS-ийн broadcast хоёр удаа ирсэн ч, retry хийсэн ч
     * ижил утга → утасны дараалалд ч, сервер дээр ч давхардахгүй.
     */
    fun messageId(sender: String, body: String, smscTimestampMillis: Long): String {
        val digest = MessageDigest.getInstance("SHA-256")
            .digest("${normalizeSender(sender)}|$smscTimestampMillis|$body".toByteArray(Charsets.UTF_8))
        return "sms-" + digest.joinToString("") { "%02x".format(it) }.take(40)
    }

    /**
     * Шүүгдсэн илгээгчийг дэлгэцэд харуулах хэлбэр: богино дугаар/нэр (банк,
     * оператор) бүтнээрээ, хувь хүний утасны дугаар бол сүүлийн 2 оронгүй.
     */
    fun diagnosticSender(raw: String?): String {
        val t = raw?.trim().orEmpty()
        val digits = t.count { it.isDigit() }
        return if (digits >= 8) t.dropLast(2) + "**" else t
    }

    fun isHttpsUrl(url: String): Boolean =
        Regex("^https://[A-Za-z0-9.-]+(:\\d{2,5})?(/.*)?$").matches(url.trim())
}
