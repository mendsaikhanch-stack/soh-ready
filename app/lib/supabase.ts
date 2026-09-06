import { createClient } from '@supabase/supabase-js';
import { safeLocal } from './safe-storage';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// ⚠️ `storage`-ыг ЗААВАЛ өгнө. Анхдагчаар supabase-js нь `window.localStorage`
// руу шууд ханддаг бөгөөд iOS Safari-ийн in-app хөтөч (Messenger, Facebook),
// Private Browsing зэрэгт тэр нь «The operation is insecure.» гэж ШИДДЭГ.
// Тэр алдаа нь аппыг бүхэлд нь «Системийн алдаа» болгож унагаадаг байв
// (2026-09-04, Өрнөлт СӨХ-ийн оршин суугч — error_logs).
// safeLocal нь хандаж чадвал localStorage, чадахгүй бол санах ой ашиглана.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: safeLocal,
    persistSession: true,
    autoRefreshToken: true,
  },
});
