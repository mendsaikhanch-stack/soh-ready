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

## 2026-10-20

| Migration | Ажилласан | Юу хийв |
|---|---|---|
| `supabase-inspection-rls-close-migration.sql` | ✅ | inspections, inspection_readings/violations/acts, inspector_assignments-ийн `true` policy-г устгав — зөвхөн service_role |
| `supabase-packages-own-unit-migration.sql` | ✅ (deploy `6158b77`-оос өмнө) | packages: оршин суугч зөвхөн өөрийн тоотын илгээмж; өөрийнхөө илгээмжийг delivered → picked_up |

**Шалгалт (демо оршин суугч, 12 тоот):** зөвхөн өөрийн тоотын илгээмж харагдана;
өөр тоотынхыг шинэчлэх оролдлого 0 мөр; өөрийнхөө «Авсан» ажиллана.

**Демо өгөгдөл:** СӨХ 2678-ийн 12 тоотод жишээ илгээмж нэмэв (packages.id = 10,
delivered) — Play review-д илгээмжийн хуудас хоосон харагдахгүйн тулд.

inspector/* хуудсууд /api/admin/db proxy-гоор уншина (байцаагчийн нэг СӨХ).
Хүснэгтүүд хоосон тул anon шалгалт хаагдсаныг батлахгүй — SQL Editor дахь
шалгах query-гоор баталгаажуулна.

## Үлдсэн ажил

- `packages` — байр (building) баганагүй тул олон байртай СӨХ-д ижил дугаартай тоотууд бие биеийнхээ илгээмжийг харна.
- `osnaa/organizations` — олон СӨХ удирдах хуудас, «нэг СӨХ» proxy загварт тохирохгүй.
- ОСНАА, байцаагчийн бичих үйлдлийг production-д нэвтэрч туршаагүй.
