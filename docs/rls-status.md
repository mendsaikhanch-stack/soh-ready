# RLS-ийн төлөв

Production-д ажилласан RLS migration-ууд, тэдгээрийн дараах шалгалт.

## 2026-10-19

| Migration | Ажилласан | Юу хийв |
|---|---|---|
| `supabase-anon-rls-close-migration.sql` | ✅ | Зөвхөн сервер/proxy ашигладаг 20 хүснэгтийг anon-д хаав; бусад 20-ийн бичих `true` policy-г устгав |
| `supabase-resident-read-tenant-migration.sql` | ✅ (deploy `8286e00`-ийн дараа) | 9 хүснэгтийн нийтийн уншилтыг authenticated + өөрийн СӨХ болгов |

**Шалгалт (anon key, зөвхөн SELECT):** 109 хүснэгтээс anon-д мөр харагдах нь 4 —
`cities`, `districts`, `khoroos`, `sokh_organizations` (бүртгэлийн хайлтад санаатай нээлттэй).

**Шалгалт (демо оршин суугч, СӨХ 2678):** `staff`, `billing_items`, `packages`,
`utility_usage`, `utility_bills` — зөвхөн өөрийн СӨХ-ийн мөр харагдана.

## Үлдсэн ажил

- `inspection_*` хүснэгтүүд `sokh_id` баганагүй — inspector/* хуудсууд anon-оор
  уншсаар байна (`_read_legacy`). Proxy-д inspection_id → inspections.sokh_id
  замаар хязгаарлах шаардлагатай.
- `packages` — нэг СӨХ-ийн оршин суугчид бие биеийнхээ `pickup_code`-ийг харна.
- `osnaa/organizations` — олон СӨХ удирдах хуудас, «нэг СӨХ» proxy загварт тохирохгүй.
- ОСНАА, байцаагчийн бичих үйлдлийг production-д нэвтэрч туршаагүй.
