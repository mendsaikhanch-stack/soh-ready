import { createClient } from '@supabase/supabase-js';

// Server-side only! RLS-г алгасаж admin операц хийнэ.
// Зөвхөн API route-д ашиглана, client-д ХЭЗЭЭ Ч ашиглахгүй.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
