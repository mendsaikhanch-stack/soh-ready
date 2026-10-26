# Khotol SMS Bridge (`mn.khotol.smsrelay`)

СӨХ-ийн дансны **ХасБанкны** гүйлгээний SMS-ийг (илгээгч `131888`) Хотолын
`POST /api/bank-sms` руу дамжуулдаг жижиг Kotlin апп. **Play Store-д гаргахгүй** —
СӨХ-ийн нэг утсанд хувийн APK болгон суулгана.

Сервер тал, админ дэлгэц, migration, эрсдэл: [`../../docs/bank-sms.md`](../../docs/bank-sms.md).

## Юу хийдэг вэ

```
SMS_RECEIVED ─▶ SmsReceiver ─▶ SmsFilter.shouldForward ─▶ Outbox (SQLite)
                                 │ илгээгч зөвшөөрөгдсөн      │ ижил messageId → 1 мөр
                                 │ OTP/нууц код биш           ▼
                                 │ MNT дүнтэй             DeliveryWorker (WorkManager)
                                 ▼                            │ DeliveryProcessor
                           бусад SMS → утаснаас гарахгүй      ▼
                                                     HTTPS POST /api/bank-sms (Bearer khsms_…)
```

- Апп SMS-ийг **задлахгүй** (тоот, орлого/зарлага). Бүтэн текстийг илгээж, сервер
  (`app/lib/bank-sms/core.ts`) задлана, давхардлыг `messageId`-аар арилгана.
- `messageId` = SHA-256(илгээгч | SMSC цаг | текст) — broadcast давхардсан ч, retry
  хийсэн ч ижил.
- Хүргэгдсэн (эсвэл татгалзсан) SMS-ийн текстийг утаснаас шууд арилгана.
- Supabase-ийн түлхүүр, серверийн нууц APK-д **байхгүй**. Зөвхөн нэг төхөөрөмжийн
  токен (`khsms_…`), Android Keystore AES-GCM-ээр шифрлэгдэж хадгалагдана.
- Лог (`Log.*`) огт бичдэггүй. Дэлгэцийн алдаа нь серверийн код (`invalid_body`)
  эсвэл HTTP статус л — SMS-ийн текст, дүн гарахгүй.

## Зөвшөөрөл

| Permission | Яагаад |
|---|---|
| `RECEIVE_SMS` | Шинэ SMS-ийг хүлээн авах. `READ_SMS` (хуучин SMS унших) **авахгүй**. |
| `INTERNET`, `ACCESS_NETWORK_STATE` | Сервер рүү илгээх, сүлжээ ирэхийг хүлээх (WorkManager). |
| `WAKE_LOCK`, `RECEIVE_BOOT_COMPLETED` | WorkManager өөрөө нэмдэг — илгээх үед утас унтахгүй, дахин асахад дараалал сэргэнэ. `FOREGROUND_SERVICE`-ийг manifest-ээс хассан. |

Receiver нь `android.permission.BROADCAST_SMS`-ээр хамгаалагдсан — зөвхөн систем
илгээж чадна. `usesCleartextTraffic=false`, network security config зөвхөн HTTPS.

## Build

Шаардлага: JDK 17, Android SDK (platform 36, build-tools 36). Gradle 8.14.3 /
AGP 8.13.0 / Kotlin 2.1.21 (`../../android` Capacitor апп-тай ижил).

```sh
# local.properties (git-д орохгүй):  sdk.dir=C\:\\Users\\<user>\\Android\\sdk
export JAVA_HOME=<JDK 17>
./gradlew testDebugUnitTest   # SmsFilterTest, DeliveryProcessorTest
./gradlew assembleDebug       # app/build/outputs/apk/debug/app-debug.apk
```

Release (даргад түгээх): `./gradlew assembleRelease`. Гарын үсгийн keystore репоны **гадна**:
`C:/Users/User/Android/keys/khotol-sms-bridge.jks` + `keystore.properties` (эсвэл
`KHOTOL_SMS_KEYSTORE_PROPS` env). Play-ийн `khotol-release.jks`-ийг бүү ашигла. **Keystore-оо
нөөцөл** — алдвал шинэ хувилбарыг дээр нь суулгаж чадахгүй (апп устгаж, токен дахин оруулна).

### Түгээх: khotol.com/sms-app

Даргад `https://www.khotol.com/sms-app` линк илгээнэ — суулгах заавар + татах товч
(`app/sms-app/page.tsx`). Шинэ хувилбар гаргахад: `versionCode`/`versionName` нэмэгдүүлж
`assembleRelease` → `public/downloads/khotol-sms-bridge-<хувилбар>.apk` болгон хуулж, хуудасны
`APK_VERSION`, `APK_SHA256`-ийг шинэчилнэ (`sha256sum`).

## Суулгах (хувийн APK)

1. Утсан дээр: Тохиргоо ▸ Утасны тухай ▸ Software information ▸ Build number-ийг
   7 удаа дарж Developer options нээнэ ▸ **USB debugging** асаана.
2. Компьютер: `adb install -r app/build/outputs/apk/debug/app-debug.apk`
   (`adb` — `<sdk>/platform-tools`). Эсвэл APK-г утсанд хуулж нээгээд «Тодорхойгүй
   эх сурвалжаас суулгах»-ыг **зөвхөн тэр удаа** зөвшөөрнө.
3. Хөтчөөс суулгахад Google Play Protect «App blocked to protect your device» гэж **хаана**
   (зөвхөн «Got it», RECEIVE_SMS-тэй sideload апп). Суулгах хооронд Play Store ▸ Play Protect ▸ ⚙ ▸
   «Scan apps with Play Protect»-ийг, Samsung дээр Тохиргоо ▸ Аюулгүй байдал ▸ **Auto Blocker**-ийг түр
   унтрааж, суулгасны дараа буцааж асаана. `adb install` хаагдахгүй. Шалгагдсан: 2026-10-26.
   Энэ апп Play-ийн хяналт, зөвшөөрөл аваагүй, авахыг ч зорихгүй.

Яагаад Play Store биш: Google Play-ийн SMS permission-ийн бодлогоор `RECEIVE_SMS`
нь үндсэн SMS апп эсвэл тусгай зөвшөөрөгдсөн ангилалд л олгогддог. Бодлогыг тойрох
арга (Accessibility, notification listener) ашиглаагүй.

## Тохиргоо, бүртгэл (enrollment)

1. Хотол ▸ Админ ▸ **Банкны SMS гүйлгээ** ▸ «Дамжуулагч утас» ▸ нэр, илгээгч
   `131888`, дансны маск → «Төхөөрөмж бүртгэж токен авах». Токен **нэг удаа** харагдана.
2. Апп ▸ нууцлалын мэдэгдлийг уншиж зөвшөөрнө (зөвшөөрөөгүй бол юу ч дамжуулахгүй).
3. Серверийн хаяг: `https://www.khotol.com` (зөвхөн `https://`; апп
   `<хаяг>/api/bank-sms` руу хандана, redirect дагахгүй). Токен, илгээгч → «Хадгалах».
4. «SMS хүлээн авах зөвшөөрөл өгөх». Саарал/идэвхгүй бол (Android 13+ Restricted
   settings): Тохиргоо ▸ Апп ▸ Khotol SMS Bridge ▸ ⋮ ▸ **Allow restricted settings**.
5. «Батарейн хязгаарлалтаас чөлөөлөх» → «Хязгаарлахгүй». Samsung: Батарей ▸
   Background usage limits ▸ **Never sleeping apps**-д нэмнэ; апп ▸ «Pause app
   activity if unused»-г унтраана.
6. «Холболт шалгах» → «✓ Холбогдлоо: <нэр>».

### API гэрээ (`/api/bank-sms`)

| Хүсэлт | Хариу |
|---|---|
| `GET` (Bearer) — холболт шалгах | `200 {device}`, `401`, `403` цуцлагдсан |
| `POST {schemaVersion:1, messageId, sender, body, receivedAt}` | `200 {accepted:true}` → delivered |
| `POST {schemaVersion:1, type:"heartbeat", pending, failed, …}` | төлөвийн мэдээ (15 мин тутам) |

Хариуны дүрэм (`DeliveryProcessor`): `2xx+accepted` → delivered · `400/413/422` →
rejected, дахин илгээхгүй · `401/403` → илгээхээ зогсоож токен шинэчлэхийг хүлээнэ ·
`429/5xx`, сүлжээ → exponential backoff (30с-ээс), дараалал хадгалагдсаар.

## Төлөвийн дэлгэц

SMS зөвшөөрөл, батарей хязгаарлалт, токен, илгээгч, сүүлд SMS хүлээн авсан /
амжилттай дамжуулсан цаг, дараалалд хүлээгдэж буй тоо, татгалзсан тоо, сүүлийн
алдаа, сүүлд шүүгдсэн илгээгч (хувийн дугаар бол сүүлийн 4 орон далд).

## Асуудал шийдэх

| Шинж | Шалтгаан / арга |
|---|---|
| SMS ирсэн ч «Сүүлд SMS хүлээн авсан» өөрчлөгдөхгүй | «Сүүлд шүүгдсэн илгээгч»-ийг хар — `+976131888` гэх мэт өөр хэлбэрээр ирж байвал илгээгчид нэмнэ. SMS зөвшөөрөл «ӨГӨӨГҮЙ» эсэх. |
| «ТОХИРГОО ДУТУУ» | Нууцлалын зөвшөөрөл, https хаяг, токен, илгээгч — аль нэг нь алга. |
| «Сервер токеныг хүлээж авсангүй (401/403)» | Админ дээр токен цуцлагдсан/солигдсон → шинэ токен оруулж «Хадгалах», «Холболт шалгах». |
| Дараалал өсөөд байна | Интернет; «Сервер түр алдаатай» бол сервер тал. «Хүлээгдэж буйг одоо илгээх». |
| Хэдэн цаг/өдрийн дараа дамжуулахаа больсон | Samsung батарей хязгаарлалт (дээрх 5-р алхам). Утас дахин асахад WorkManager өөрөө сэргэнэ. |
| «SMS татгалзсан: invalid_body» г.м. | Сервер payload-ийг хүлээж аваагүй — админы «SMS лог»-оос шалтгааныг хар. |

## Бодит төхөөрөмж дээр турших

**Энэ апп бодит Samsung утсан дээр хараахан туршигдаагүй.** Checklist:
[`docs/bank-sms.md` §5](../../docs/bank-sms.md). Хамгийн чухал нь:

1. `131888` Samsung дээр ямар илгээгчийн хэлбэрээр ирдэг.
2. Бага дүнгийн шилжүүлэг → 1 минутын дотор админ дээр харагдах.
3. Нислэгийн горим → дараалалд хүлээгдээд интернет ирэхэд давхардалгүй илгээгдэх.
4. Утсыг дахин асаасны дараа, 1 өдөр хөндөлгүй орхисны дараа ажиллах.
5. Хувийн SMS, OTP админ дээр **огт** харагдахгүй.

## Файлууд

| Файл | |
|---|---|
| `SmsReceiver.kt` | `SMS_RECEIVED` → multipart нийлүүлэх → `SmsFilter` → `Outbox` |
| `SmsFilter.kt` | Илгээгч, OTP, гүйлгээний бүтэц, тогтвортой `messageId` (цэвэр Kotlin) |
| `DeliveryProcessor.kt` | Хүргэлтийн дүрэм, `DeliveryQueue` interface (цэвэр Kotlin, тестлэгдсэн) |
| `Outbox.kt` | SQLite дараалал (`DeliveryQueue`), 14 хоногийн дараа мета устгана |
| `DeliveryWorker.kt` | WorkManager: SMS бүрд + 15 мин тутам, retry, heartbeat |
| `ApiClient.kt` | HTTPS, Bearer токен, redirect дагахгүй |
| `RelayConfig.kt` | Тохиргоо; токен Keystore-оор шифрлэгдсэн |
| `MainActivity.kt` | Нууцлалын мэдэгдэл, тохиргоо, төлөв |
