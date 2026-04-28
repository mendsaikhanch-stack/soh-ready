# Хотол — Өөрийгөө сэргээдэг систем (Self-Healing Layer)

> Системд алдаа гарвал **хүн оролцоогүйгээр өөрөө засаад үргэлжлүүлдэг** автомат хамгаалалтын давхрага. Зөвхөн үнэхээр сэргээгдэхгүй болсон үед л superadmin-д ил гарна.

---

## Яагаад хэрэгтэй вэ

Production орчинд алдаа зайлшгүй гардаг:

- Сүлжээ түр тасрах
- DB-н түр ачаалал
- Гадаад API-ны timeout
- Push subscription хуучирсан
- Hand-touched data-д орхигдсон orphan record

Эдгээрийг **хэрэглэгч мэдэхгүйгээр**, **ажилтан хөдөлгөөнгүйгээр** засах нь манай системийн найдвартай байдлын үндэс юм.

---

## 4 түвшний хамгаалалт

### 1️⃣ Шууд retry — Үндсэн flow доторх алдаа

Хэрэглэгч ямар нэгэн үйлдэл хийж байх үед нэг алхам алдаа гарвал, **үндсэн хариу зогсолгүй** хэвээр буцаагдана. Гэхдээ алдсан алхмыг автомат job болгон дараалалд тавина.

**Хамрах хүрээ:**

| Үйлдэл | Алдсан тохиолдолд |
|--------|-------------------|
| Шинэ хэрэглэгч бүртгүүлэх | Manual signup-ыг user-тай холбох оролдлого retry |
| СӨХ-ийн claim хийх | Claim link сэргээх retry |
| Provisional СӨХ-г merge хийх | Auto-merge scan-г retry |

**Хариу:**
- 30 секунд → 2 минут → 10 минут → 30 минут → 2 цагийн backoff
- 5 удаа оролдоно. Бүтэхгүй бол **DEAD** төлөвт орж alert үүсгэнэ.

---

### 2️⃣ Job runner — Минут тутамд

Vercel cron `*/1 * * * *` нь queue-н PENDING job-уудыг автомат боловсруулна.

**Хамгаалалт:**
- ✓ **Timeout:** Handler 60 секундээс удвал автомат cancel болж дараагийн оролдлого хийнэ (hang-аас сэргийлнэ)
- ✓ **Stuck reclaim:** RUNNING статусаар 10 минутаас удсан job-ыг PENDING руу буцаана (worker унавал ч ажил алга болохгүй)
- ✓ **Idempotent:** Ижил түлхүүртэй давхар job үүсэхгүй
- ✓ **Sentry capture:** Бүх алдаа observability-д бичигдэнэ

---

### 3️⃣ Reconciliation — Тогтмол шалгалт

Системийн өгөгдөл цаг хугацаанд "drift" болохыг (зөрөх) автомат олж засна.

| Шалгалт | Давтамж | Юу хайх | Юу засах |
|---------|:-------:|---------|----------|
| **Claims** | Цаг тутам | `user_id IS NULL` мөртлөө claim хийгдсэн байх ёстой membership-ууд | Холбоог сэргээж re-link |
| **Activation summary** | 6 цаг | Тоологдсон тоо ба бодит тоо зөрсөн summary | Дахин тооцоолж шинэчлэх |
| **Orphan merges** | 6 цаг | Merge амжилтгүй болсон үлдэгдэл бичлэгүүд | Цэвэрлэж, signup flow-г сэргээх |
| **Auto-merge** | Өдөр бүр 03:00 | Provisional СӨХ-той ижил directory entry | Автомат нэгтгэх |
| **Notifications** | 5 минут | `failed` status-тай мэдэгдэл | Retry queue-нд оруулах |

---

### 4️⃣ Notification outbox — Push мэдэгдэл

Push notification илгээхэд бүх subscriber-т алдаа гарвал:

```
PENDING → [push attempt #1] → FAILED (attempts=1)
        ↓ 60 секунд хүлээх
PENDING → [push attempt #2] → FAILED (attempts=2)
        ↓ 60 секунд хүлээх
PENDING → [push attempt #3] → FAILED (attempts=3)
        ↓
        DEAD + Critical alert
```

**Жишээ нөхцөл:**
- VAPID түр алдагдсан → 1-2 минутын дараа автомат сэргэнэ
- Subscription expire хийсэн (HTTP 410) → автомат устгана
- Тухайн СӨХ-д идэвхтэй subscription байхгүй → амжилттай гэж үзэн (no-op)

---

## Алертын систем

### Alert хэзээ үүсдэг вэ?

| Шалтгаан | Severity | Жишээ |
|----------|:--------:|-------|
| Job DEAD болох (5 удаа retry бүтэхгүй) | 🚨 Critical | "repair_manual_signup_flow job DEAD: residentId required" |
| Notification 3 удаа retry бүтэхгүй | 🚨 Critical | "Scheduled notification #42 max retries давлаа" |

### Хаашаа очдог вэ?

1. **DB:** `system_alerts` хүснэгтэд бичигдэнэ
2. **Admin UI:** `/mng-ctrl/system-health` хуудасны **дээд талд banner** болж харагдана
3. **Webhook (заавал биш):** `ALERT_WEBHOOK_URL` тохируулсан бол Slack/Discord руу шууд push явна

### Анхааруулга давхардлаас хэрхэн сэргийлэх вэ?

`dedup_key` ашигладаг — нэг асуудлаас зөвхөн нэг идэвхтэй alert үүснэ:
- `job:dead:42` — нэг job-д зөвхөн нэг alert
- `notif:dead:142` — нэг notif-д зөвхөн нэг alert

Superadmin **"✓ Ack"** дарсны дараа л шинэ alert үүсэх боломжтой.

---

## Admin хяналтын самбар

### `/mng-ctrl/system-health` (зөвхөн superadmin)

**30 секунд тутамд автомат refresh** хийгдэнэ.

**Харуулах:**
- 🚨 **Идэвхтэй алертууд** (хамгийн дээр)
- Job статистик: Pending / Running / Failed / Dead / 24ц-н Done
- Drift тоонууд: Summary mismatch, Unclaimed members, Pending provisionals
- 💀 **Dead jobs** (сүүлийн 20) — payload, error, **🔁 Retry товчтой**
- ⏳ **Хүлээж буй retry** — дараагийн оролдлогын цаг

---

## Тоо баримт

**Дэд бүтэц:**
- 6 ажлын төрлийн handler
- 3 reconciliation service
- 6 cron schedule (1мин, 5мин, 1ц, 6ц-2 хувилбар, 1өдөр)
- 3 төрлийн авто-засварын hook (бүртгэл, claim, merge)

**Найдвартай байдлын тооцоо:**

| Алдааны төрөл | Автомат сэргэх магадлал |
|----------------|:-----------------------:|
| Сүлжээ/DB түр унтрах | ~99% |
| Handler hang | ~95% (timeout-оор) |
| Push subscription expire | 100% (auto-cleanup) |
| Activation summary drift | 100% (6ц тутам) |
| Orphan record үлдэх | 100% (өдрийн scan) |

---

## Тохиргоо (env)

| Хувьсагч | Тайлбар | Заавал |
|----------|---------|:------:|
| `CRON_SECRET` | Cron endpoint-ын баталгаажуулалт | ✓ |
| `ALERT_WEBHOOK_URL` | Slack/Discord webhook (`{ text }` format) | – |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Web Push public key | ✓ (push ашиглавал) |
| `VAPID_PRIVATE_KEY` | Web Push private key | ✓ (push ашиглавал) |

---

## Migration түүх

| Файл | Огноо | Агуулга |
|------|-------|---------|
| `supabase-system-jobs-migration.sql` | 2026-04-27 | Үндэс: `system_jobs`, `system_job_attempts`, `reclaim_stuck_jobs()` |
| `supabase-self-healing-v2-migration.sql` | 2026-04-28 | v2: `timeout_sec`, `system_alerts`, notification outbox талбарууд |

---

## Цаашид нэмэх боломжтой

- 🔔 Webhook-аас гадна email/SMS alerting
- 📊 `system_reconcile_runs` log + drift trend chart
- 🛠️ Admin UI: bulk retry, manual enqueue, attempt history view
- 📈 Cron last-run badges (хамгийн сүүлийн амжилттай run харуулах)

---

*Энэхүү давхрага нь бизнесийн логикын алдааг **арилгахаас илүү**, харин **далд барьж сэргээх**-д зориулагдсан. Алдаа гарах нь зайлшгүй — хариу үйлдэл нь автомат байх ёстой.*
