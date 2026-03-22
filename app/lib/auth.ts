import { supabase } from './supabase';

// Supabase Auth ашиглан админ нэвтрэлт
export async function signInAdmin(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) return { success: false, error: error.message };

  // admin role шалгах
  const { data: profile } = await supabase
    .from('admin_users')
    .select('role')
    .eq('user_id', data.user.id)
    .single();

  if (!profile || !['admin', 'superadmin'].includes(profile.role)) {
    await supabase.auth.signOut();
    return { success: false, error: 'Админ эрхгүй хэрэглэгч' };
  }

  return { success: true, user: data.user, role: profile.role };
}

export async function signOutAdmin() {
  await supabase.auth.signOut();
}

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  const { data: profile } = await supabase
    .from('admin_users')
    .select('role, sokh_id')
    .eq('user_id', session.user.id)
    .single();

  return profile ? { user: session.user, ...profile } : null;
}

// Rate limiter — login оролдлого хязгаарлах
const loginAttempts = new Map<string, { count: number; lastAttempt: number }>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 минут

export function checkRateLimit(identifier: string): { allowed: boolean; remainingMs?: number } {
  const now = Date.now();
  const record = loginAttempts.get(identifier);

  if (!record) {
    loginAttempts.set(identifier, { count: 1, lastAttempt: now });
    return { allowed: true };
  }

  // Lockout хугацаа дууссан бол reset
  if (now - record.lastAttempt > LOCKOUT_MS) {
    loginAttempts.set(identifier, { count: 1, lastAttempt: now });
    return { allowed: true };
  }

  if (record.count >= MAX_ATTEMPTS) {
    return { allowed: false, remainingMs: LOCKOUT_MS - (now - record.lastAttempt) };
  }

  record.count++;
  record.lastAttempt = now;
  return { allowed: true };
}

export function resetRateLimit(identifier: string) {
  loginAttempts.delete(identifier);
}
