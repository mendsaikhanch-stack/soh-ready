import { supabase } from './supabase';

let cachedSokhId: number | null = null;

export async function getAdminSokhId(): Promise<number> {
  if (cachedSokhId) return cachedSokhId;

  const { data } = await supabase
    .from('admin_config')
    .select('sokh_id')
    .eq('admin_username', 'admin')
    .single();

  const sokhId = data?.sokh_id || 7;
  cachedSokhId = sokhId;
  return sokhId;
}

export function clearAdminSokhIdCache() {
  cachedSokhId = null;
}
