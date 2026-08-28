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
export async function loadSignIns(tag = 'auth-signins'): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    for (let page = 1; page <= 20; page++) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error || !data) break;
      for (const u of data.users) {
        if (u.last_sign_in_at) map.set(u.id, u.last_sign_in_at);
      }
      if (data.users.length < 1000) break;
    }
  } catch (e) {
    console.error(`[${tag}] listUsers`, e);
  }
  return map;
}
