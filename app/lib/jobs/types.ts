// Job queue type definitions

export type JobStatus = 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'DEAD';

export type JobType =
  | 'repair_manual_signup_flow'
  | 'retry_manual_claim_link'
  | 'rebuild_activation_summary'
  | 'retry_provisional_merge'
  | 'auto_merge_provisionals_scan'
  | 'retry_notification_delivery';

export interface SystemJob {
  id: number;
  job_type: JobType;
  payload: Record<string, unknown>;
  status: JobStatus;
  attempts: number;
  max_attempts: number;
  available_at: string;
  locked_at: string | null;
  locked_by: string | null;
  last_error: string | null;
  idempotency_key: string | null;
  created_at: string;
  updated_at: string;
}

export interface EnqueueOptions {
  /** Хойшлуулах секунд (delay) */
  delaySec?: number;
  /** Хамгийн их оролдлогын тоо (default 5) */
  maxAttempts?: number;
  /** Идэмпотент түлхүүр — ижил түлхүүртэй pending/running job дахин үүсгэхгүй */
  idempotencyKey?: string;
}

// Job handler signature — payload авч идэмпотент үйлдэл хийнэ.
// throw error — retry логик ажиллана.
// resolve void — succeed гэж тэмдэглэгдэнэ.
export type JobHandler<P = Record<string, unknown>> = (
  payload: P,
  ctx: { job: SystemJob; supabase: import('@supabase/supabase-js').SupabaseClient }
) => Promise<void>;
