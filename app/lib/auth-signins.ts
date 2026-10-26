import { supabaseAdmin } from '@/app/lib/supabase-admin';

// Оршин суугч Supabase Auth-аар нэвтэрдэг тул «аппаа нээж үзсэн үү» гэдгийн
// цорын ганц бодит ул мөр нь auth.users.last_sign_in_at. Энэ хүснэгтийг
// PostgREST-ээр уншиж болдоггүй учир admin API-аар хуудаслан татна.
//
// Анхаар: last_sign_in_at нь ШИНЭ нэвтрэлт бүрд шинэчлэгддэг. Апп нээлттэй
// хэвээр байгаа хүн дахин нэвтрэхгүй тул «сүүлийн 7 хоногт» тоо бодит
// хэрэглээнээс бага гарч болно. «Нэвтэрч үзсэн» тоо л бүрэн найдвартай.
//
// auth_user_id → сүүлд нэвтэрсэн огноо
//
// listUsers нь auth.users-ийг БҮХЭЛД нь уншдаг тул админ самбар нээх бүрд
// дуудахгүйн тулд instance дотор 5 минут кэшилнэ. Кэш нь платформын нийт
// жагсаалт — СӨХ-ээр шүүх ажлыг дуудагч route хүсэлт бүрд хийнэ.
const SIGNINS_TTL_MS = 5 * 60 * 1000;
let signInsCache: { at: number; map: ReadonlyMap<string, string> } | null = null;

export async function loadSignIns(tag = 'auth-signins'): Promise<ReadonlyMap<string, string>> {
  if (signInsCache && Date.now() - signInsCache.at < SIGNINS_TTL_MS) return signInsCache.map;

  const map = new Map<string, string>();
  let complete = false;
  try {
    for (let page = 1; page <= 20; page++) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error || !data) break;
      for (const u of data.users) {
        if (u.last_sign_in_at) map.set(u.id, u.last_sign_in_at);
      }
      if (data.users.length < 1000) { complete = true; break; }
    }
  } catch (e) {
    console.error(`[${tag}] listUsers`, e);
  }
  // Алдаатай / дутуу жагсаалтыг кэшлэхгүй
  if (complete) signInsCache = { at: Date.now(), map };
  return map;
}
