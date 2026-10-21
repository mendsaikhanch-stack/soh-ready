// СӨХ-ийн жинхэнэ байрнуудын жагсаалт (33А, 33Б… эсвэл 1-1, 2-1…).
//
// Бүртгүүлэх хуудасны сонголт, серверийн шалгалт хоёулаа эндээс уншина —
// хоёр өөр жагсаалт харуулбал сонгосон байр нь сервер дээр «буруу» гарна.
//
// residents.building нь даргын импорт ДЭЭР оршин суугчдын гараар бичсэн утгыг
// бас агуулдаг (Аман хуур: «33», СӨХ #2694: «5», «205», «498/5»). Тэдгээрийг
// жагсаалтад гаргавал дахиад тийшээ бүртгэгдэнэ, тиймээс шүүнэ:
//   • «33А» байхад «33» — орцоо орхисон бичлэг
//   • хамгийн том байрны 5%-иас цөөн айлтай — гараар бичсэн цөөн тохиолдол

import { supabaseAdmin } from '@/app/lib/supabase-admin';

export async function loadSokhBuildings(sokhId: number): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from('residents')
    .select('building')
    .eq('sokh_id', sokhId)
    .not('building', 'is', null)
    .limit(10000);
  if (error) {
    console.error('[sokh-buildings]', error.message);
    return [];
  }

  const counts = new Map<string, number>();
  for (const r of data || []) {
    const b = String(r.building).trim();
    if (b) counts.set(b, (counts.get(b) || 0) + 1);
  }
  const all = [...counts.keys()];
  const largest = Math.max(0, ...counts.values());
  const minUnits = Math.max(3, Math.ceil(largest * 0.05));

  return all
    .filter(b => (counts.get(b) || 0) >= minUnits)
    .filter(b => !all.some(o => o !== b && o.startsWith(b) && /^[\p{L}\-/]/u.test(o.slice(b.length))))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}
