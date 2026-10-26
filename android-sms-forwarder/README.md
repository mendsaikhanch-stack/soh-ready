# Хотол SMS дамжуулагч (`mn.khotol.smsrelay`)

СӨХ-ийн дансны банкны гүйлгээний SMS-ийг `POST /api/bank-sms` руу дамжуулдаг
жижиг Kotlin апп. **Play Store-д гаргахгүй** — СӨХ-ийн нэг утсанд хувийн APK.

Бүрэн заавар, checklist, эрсдэл: [`../docs/bank-sms.md`](../docs/bank-sms.md).

```
./gradlew test             # SmsFilterTest
./gradlew assembleDebug    # app/build/outputs/apk/debug/
```

| Файл | |
|---|---|
| `SmsReceiver.kt` | `SMS_RECEIVED` → илгээгч шүүх → `Outbox` |
| `SmsFilter.kt` | Илгээгч, OTP шүүлтүүр, тогтвортой messageId (цэвэр, тестлэгдсэн) |
| `Outbox.kt` | SQLite дараалал; сервер хүлээж авсны дараа л `delivered` |
| `DeliveryWorker.kt` | WorkManager: илгээх, retry, 15 мин heartbeat |
| `ApiClient.kt` | HTTPS, Bearer токен, redirect дагахгүй |
| `RelayConfig.kt` | Тохиргоо; токен Android Keystore AES-GCM-ээр шифрлэгдсэн |
| `MainActivity.kt` | Тохиргоо + төлөв |
