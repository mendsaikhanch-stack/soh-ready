// Job enqueue — request flow-уудаас дуудна.
// Идэмпотент: давхар pending/running job үүсгэхгүй (`idempotency_key` ашиглавал).
// Алдаа гарвал console.error + throw НЕ хийнэ — primary flow-ыг буруутгахгүй.

import { supabaseAdmin } from '@/app/lib/supabase-admin';
import type { JobType, EnqueueOptions } from './types';

export async function enqueueJob(
  jobType: JobType,
  payload: Record<string, unknown> = {},
  options: EnqueueOptions = {}
): Promise<{ jobId: number | null; created: boolean; error?: string }> {
  const { delaySec = 0, maxAttempts = 5, idempotencyKey, timeoutSec } = options;

  const available_at = new Date(Date.now() + delaySec * 1000).toISOString();

  // Идэмпотент шалгалт: тухайн job_type+key-тэй идэвхтэй (PENDING|RUNNING) job байвал нэмэхгүй
  if (idempotencyKey) {
    const { data: existing } = await supabaseAdmin
      .from('system_jobs')
      .select('id, status')
      .eq('job_type', jobType)
      .eq('idempotency_key', idempotencyKey)
      .in('status', ['PENDING', 'RUNNING'])
      .maybeSingle();
    if (existing) {
      return { jobId: existing.id as number, created: false };
    }
  }

  const { data, error } = await supabaseAdmin
    .from('system_jobs')
    .insert([{
      job_type: jobType,
      payload,
      status: 'PENDING',
      available_at,
      max_attempts: maxAttempts,
      idempotency_key: idempotencyKey || null,
      ...(timeoutSec ? { timeout_sec: timeoutSec } : {}),
    }])
    .select('id')
    .single();

  if (error || !data) {
    console.error('[enqueueJob]', jobType, error?.message);
    return { jobId: null, created: false, error: error?.message };
  }

  return { jobId: data.id as number, created: true };
}

/** Шууд executable: primary flow-ын дотор try/finally-аас дуудах баталгаатай wrapper.
 *  Алдаа throw хийхгүй — primary response-ыг бурууд оруулахгүй. */
export async function enqueueRepair(
  jobType: JobType,
  payload: Record<string, unknown> = {},
  options: EnqueueOptions = {}
): Promise<void> {
  try {
    await enqueueJob(jobType, payload, options);
  } catch (e) {
    console.error('[enqueueRepair] suppressed', jobType, e);
  }
}
