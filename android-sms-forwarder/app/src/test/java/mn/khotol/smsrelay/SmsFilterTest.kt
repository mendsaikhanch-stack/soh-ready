package mn.khotol.smsrelay

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class SmsFilterTest {
    private val credit = "Таны 5006***029 тоот дансанд 55,000.00MNT ORLOGO орлоо. Uldegdel 61,909.93MNT Ognoo: 2026-10-25; qpay 200000779046929 613toot"

    @Test fun senderNormalization() {
        assertEquals("131888", SmsFilter.normalizeSender("+131888"))
        assertEquals("131888", SmsFilter.normalizeSender(" 131 888 "))
        assertEquals("XACBANK", SmsFilter.normalizeSender("XacBank"))
        assertTrue(SmsFilter.isAllowedSender("131888", listOf("131888")))
        assertFalse(SmsFilter.isAllowedSender("99112233", listOf("131888")))
        assertFalse(SmsFilter.isAllowedSender(null, listOf("131888")))
        assertFalse(SmsFilter.isAllowedSender("131888", emptyList()))
    }

    @Test fun secretCodesAreNotForwarded() {
        assertTrue(SmsFilter.isSecretCode("Таны нэг удаагийн нууц код: 482913"))
        assertTrue(SmsFilter.isSecretCode("XacBank OTP 123456"))
        assertTrue(SmsFilter.isSecretCode("Нэвтрэх код 1234"))
        assertFalse(SmsFilter.isSecretCode(credit))
    }

    @Test fun messageIdIsStable() {
        val a = SmsFilter.messageId("131888", credit, 1761369600000)
        assertEquals(a, SmsFilter.messageId("+131888", credit, 1761369600000))
        assertNotEquals(a, SmsFilter.messageId("131888", credit, 1761369600001))
        assertTrue(Regex("^[A-Za-z0-9_.:-]{8,128}$").matches(a))
    }

    @Test fun diagnosticSenderHidesPersonalNumbers() {
        assertEquals("131888", SmsFilter.diagnosticSender("131888"))
        assertEquals("+9769911**", SmsFilter.diagnosticSender("+97699112233"))
    }

    @Test fun onlyHttps() {
        assertTrue(SmsFilter.isHttpsUrl("https://www.khotol.com"))
        assertFalse(SmsFilter.isHttpsUrl("http://www.khotol.com"))
        assertFalse(SmsFilter.isHttpsUrl("https://evil.com@x"))
    }
}
