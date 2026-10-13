# 12 Testers (Testers Community) апп ашиглах заавар — 2026-10-13

> Яагаад: 2026-08-28-нд «Testers were not engaged» гэж татгалзсан. Бодит
> СӨХ-ийн оршин суугчдаас 12+ идэвхтэй тестер цуглуулах нь удаан байгаа тул
> тестер солилцооны үйлчилгээг нэмэлтээр ашиглана.
> Үйлчилгээ: Play Store дээрх «12 Testers - Testers Community» апп /
> https://www.testerscommunity.com

## 1. Апп-д оруулах мэдээлэл (хуулж тавина)

| Талбар | Утга |
|---|---|
| App name | `Khotol (Хотол)` |
| Package name | `mn.khotol.app` |
| **Testing (opt-in) link** | `https://play.google.com/apps/testing/mn.khotol.app` |
| Play Store link | `https://play.google.com/store/apps/details?id=mn.khotol.app` (нэгдээгүй хүнд 404 — хэвийн) |
| Web link (Android-гүй хүнд) | `https://www.khotol.com` |
| Category | House & Home / Productivity |
| **Logo** | `playstore/testers-community/khotol-logo-512.png` (512×512; томоор нь `khotol-logo-1024.png`) |

**Тестерт өгөх заавар (англиар — тестерүүд гадаад хүмүүс):**

> Цэсний нэрсийг `app/(mobile)/sokh/[id]/page.tsx`-ийн `tabMenus`-ээс
> шалгасан (2026-10-13). Цэс өөрчлөгдвөл энэ бичвэрийг шинэчил.

```
Khotol is an app for apartment owners' associations (HOA) in Mongolia:
announcements, monthly fees, complaints, finance reports, neighbor chat.
The interface is in Mongolian — Google Lens / Translate camera helps.

LOGIN (demo account, no real personal data):
  If you see a website-like start page, tap "Нэвтрэх" (Log in) at the top.
  Phone number: 88000000
  Password:     Demo12345!

Please open the app every day for 14 days and try a few of these.
They are on the home screen, under the green "СӨХ" tab:

 1. 📢 Зарлал (Announcements) — read the latest notices
 2. 💰 Төлбөр (Payment) — see the monthly fee and balance
 3. 📋 Зарцуулалт (Spending) — HOA income/expense report
 4. 💰 Санхүү (Finance) — where the fees are spent
 5. 📝 Гомдол / Санал (Complaint / Suggestion) — tap
    "+ Шинэ гомдол / санал бичих", write a short test message,
    tap "Илгээх" (Send)
 6. 💬 Хөрш чат (Neighbor chat) — say hello
 7. 🗳 Санал хураалт (Voting) — view polls
 8. 🔧 Засвар (Repair) — view repair requests and completed works
 9. Tap your name at the top to open your profile

Other tabs: "ОСНАА" (water/heating) and "Цахилгаан" (electricity).

Feedback about bugs or confusing screens is very welcome. Use
"Гомдол / Санал" in the app or the Testers Community chat.
```

## 2. Play Console дээр хийх тохиргоо

1. **Testing ▸ Closed testing ▸ (Alpha) ▸ Testers** — «Email lists» ба
   «Google Groups» нь **радио сонголт: зөвхөн нэг нь идэвхтэй** (хоёулаа
   зэрэг БОЛОХГҮЙ). 2026-10-13-нд Google Groups
   `testers-community@googlegroups.com` болгож сольсон → «Хотол — пилот
   тестерүүд» (26 хаяг) жагсаалт track-аас салсан. Хэрэглэгч «12/14 хоног
   шинээр эхэлсэн ч хамаагүй» гэж зөвшөөрсөн. Хуучин тестерүүдийг буцааж
   оруулах бол тэд группт элсэх ёстой (эсвэл тусдаа closed track).
2. **Countries/regions** — track 177 улстай (2026-08-02). Гадаад тестерүүд
   суулгаж чадна. Шинэ тестер «not available in your country» гэвэл улсаа
   шалга.
3. Тест явж байх хугацаанд **Release 5 (v1.0.3)**-ыг гарга — шинэ хувилбар
   upload хийхэд 14 хоногийн тоолол дахин эхлэхгүй (RELEASE_LOG.md §Release 4).

## 3. Үнэгүй ба төлбөртэй зам

| Зам | Яаж | Анхаар |
|---|---|---|
| **Үнэгүй (credit)** | Бусдын аппыг тестлэж credit цуглуулна (1 credit ≈ 15–20 мин) → аппаа нийтэлнэ | 14 хоног өдөр бүр бусдын аппыг нээх үүрэг. Тестерүүд нь хөгжүүлэгчид — production баталгаа байхгүй |
| **Pack of Wolves** | 16 хөгжүүлэгч 16 хоног бие биеийн аппыг өдөр бүр тестлэнэ | Өдөр бүр 15 апп тестлэх — их цаг. Тасалбал reputation унана |
| **Төлбөртэй** | Starter $12 (15 тестер) / Pro $20 (25 тестер); production-д ороогүй бол буцаан олголт | Хамгийн бага цаг зарцуулна. Google Group-ээ Console-д нэмэх л үлдэнэ |

### Аппын «How It Works»-оос уншсан бодит дүрэм (2026-10-13)

Валют нь **moon**. Алхам: ① App Library-д нэмэх (үнэгүй, зөвхөн загвар) →
② Quick Apps-д жагсаах (**60 moon**, Home feed-д гарна; production
баталгаагүй) → ③ **Pack-д нэгдэх — ЗААВАЛ** (**100 moon**; 16 хөгжүүлэгч,
16 хоног) → ④ Pack дуусмагц Play Console-оос production хүсэх.

Pack дүрэм: бусад 15 аппыг **өдөр бүр** нээх (100% өдөр = +15 moon);
70%-аас доош = −30 moon + strike; 3 strike = хасагдана; идэвхтэй үед гарвал
−200 moon, −25 RP. Суулгах хугацаа хоцорвол хасагдана. **5 гишүүн «апп руу
нэвтрэх боломжгүй» гэж мэдээлбэл таны апп Pack-аас хасагдана** → демо
нэвтрэлт заавал тод байх ёстой.

Moon олох: Home feed-ээс бусдын апп туршиж (карт бүр дээр moon заасан),
суулгасан хэвээр өдөр бүр нээх. Зорилт 160 moon (60 + 100).
Төлбөртэй хувилбар: **Private Testing Starter $25/апп** (аппад харуулсан үнэ;
вэбийн $12/$20-оос өөр) — 8 цагт хуваарилна, production-д ороогүй бол буцаана.

## 4. Эрсдэл / анхааруулга

- Google өргөдлийг **гараар** хянаж, session, retention, санал хүсэлтийг
  хардаг. Солилцооны тестерүүд ихэвчлэн 1 удаа нээгээд орхидог тул
  өмнөх «not engaged» татгалзал давтагдаж болно. Тестерүүдээс **санал
  бичүүлж** (screenshot-оор хадгал) Production өргөдлийн Part 1-д ашигла.
- Апп монгол хэлтэй, демо дансаар нэвтэрнэ — нэвтрэх мэдээлэл заавар
  дотор тод байх ёстой, эс бөгөөс тестерүүд нэвтрэх дэлгэц дээр зогсоно.
- Бүх тестер **нэг демо данс** (88000000) ашиглана — өгөгдөл нь демо СӨХ
  тул бодит оршин суугчдад нөлөөлөхгүй, гэхдээ тест хүсэлт/гомдлууд
  демо СӨХ-д хуримтлагдана.
- СӨХ-ийн бодит хэрэглэгчдээс тестер цуглуулах ажлыг зогсоохгүй
  (TESTER_RECRUIT_2026-09-12.md) — тэд хамгийн үнэмшилтэй engagement.

## 5. Явц (энд тэмдэглэ)

| Огноо | Юу хийсэн |
|---|---|
| 2026-10-13 | Үйлчилгээг судалж, оруулах мэдээлэл бэлтгэв |
| 2026-10-13 | Демо данс (88000000) live дээр нэвтэрч байгааг шалгав — Демо СӨХ #2678, тоот 12, зарлал 4, гомдол 3 |
| 2026-10-13 | Демо айлд (resident 762) 2026-10 сарын 50,000₮ төлөгдөөгүй нэхэмжлэх нэмэв (invoices #1335, хугацаа 11-05, `pending`). Тестийн дараа «төлсөн» болгох эсвэл устгах |
| 2026-10-13 | Хэрэглэгч Testers Community Google Group-т элсэв (`testers-community@googlegroups.com`). Группын дүрэм: «бусдын 3 аппыг тестлээд 12+ тестер үнэгүй» |
| 2026-10-13 | Play Console ▸ Closed testing - Alpha ▸ Testers: Email lists → **Google Groups** (`testers-community@googlegroups.com`) болгож Save ▸ Publishing overview ▸ «Send changes for review» илгээв. Managed publishing off. 12 tester / 14 хоногийн тоолол шинээр эхэлнэ гэж үзнэ |
| 2026-10-13 | Credit цуглуулах: бусдын 3 аппыг суулгаж туршив (Sudoku, DOMIO, эрүүл мэндийн timeline апп). Карт нэхсэн нэг аппыг алгасав. 14 хоног өдөр бүр нээх, бүү устга |
| 2026-10-13 | Google Groups өөрчлөлтийг Google баталж нийтлэв («App update published»). Группын гишүүд одоо opt-in хийж суулгаж чадна |
| 2026-10-13 | **Үнэгүй зам** сонгов. Хотолыг App Library-д нэмэв. Дараагийнх: 60 moon → Quick Apps, 100 moon → Pack (заавал) |
