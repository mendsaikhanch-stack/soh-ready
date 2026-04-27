// Job worker — claim, run, mark success/failure with exponential backoff.
// Cron route-аас (e.g. /api/cron/jobs) дуудна.
// Нэг тиктэнд бага batch (default 10) ажиллуулж дуусна.

import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { randomUUID } from 'crypto';
import * as Sentry from '@sentry/nextjs';
import type { JobHandler, JobType, SystemJob } from './types';
import { handlers } from './handlers';

// Алдаа давтагдвал хойшлуулах хүснэгт (секундээр)
function backoffSec(attempts: number): number {
  // 1: 30s, 2: 2m, 3: 10m, 4: 30m, 5: 2h
  const steps = [30, 120, 600, 1800, 7200];
  return steps[Math.min(attempts - 1, steps.length - 1)] ?? 7200;
}

/** Stuck RUNNING job-уудыг буцаах — claim хийхээсээ өмнө run хийхэд аюулгүй */
export async function reclaimStuckJobs(staleMinutes = 10): Promise<number> {
  const { data, error } = await supabaseAdmin.rpc('reclaim_stuck_jobs', {
    stale_minutes: staleMinutes,
  });
  if (error) {
    console.error('[reclaimStuckJobs]', error.message);
    return 0;
  }
  return Number(data) || 0;
}

/** Дараагийн ажиллах боломжтой job-уудыг lock хийж авна. */
export async function claimNextJobs(limit = 10): Promise<SystemJob[]> {
  const lockedBy = `worker:${process.pid}:${randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();

  // Эхлээд боломжтой ID-уудыг сонгож, дараа нь UPDATE хийх (race-аас сэргийлэх)
  const { data: candidates, error: selErr } = await supabaseAdmin
    .from('system_jobs')
    .select('id')
    .eq('status', 'PENDING')
    .lte('available_at', now)
    .order('available_at', { ascending: true })
    .limit(limit);

  if (selErr || !candidates || candidates.length === 0) {
    if (selErr) console.error('[claimNextJobs select]', selErr.message);
    return [];
  }

  const ids = candidates.map(c => c.id as number);
  const { data: locked, error: updErr } = await supabaseAdmin
    .from('system_jobs')
    .update({
      status: 'RUNNING',
      locked_at: now,
      locked_by: lockedBy,
      attempts: undefined as unknown as number, // attempts-ыг runJob дотор increment хийнэ
    })
    .in('id', ids)
    .eq('status', 'PENDING') // double-check race-аас сэргийлэх
    .select('*');

  if (updErr) {
    console.error('[claimNextJobs update]', updErr.message);
    return [];
  }
  return (locked || []) as SystemJob[];
}

export async function runJob(job: SystemJob): Promise<void> {
  const handler = handlers[job.job_type as JobType] as JobHandler | undefined;
  const attemptNo = job.attempts + 1;
  const startedAt = new Date().toISOString();

  // Attempt бичлэг үүсгэнэ
  const { data: attempt } = await supabaseAdmin
    .from('system_job_attempts')
    .insert([{ job_id: job.id, attempt_no: attemptNo, started_at: startedAt }])
    .select('id')
    .single();

  if (!handler) {
    await markFailure(job, attemptNo, attempt?.id, `No handler for ${job.job_type}`, true);
    return;
  }

  try {
    await handler(job.payload, { job, supabase: supabaseAdmin });
    await markSuccess(job, attemptNo, attempt?.id);
  } catch (e) {
    const msg = (e as Error)?.message || String(e);
    Sentry.captureException(e, {
      tags: { job_type: job.job_type, job_id: String(job.id) },
      extra: { attempt: attemptNo, payload: job.payload },
    });
    await markFailure(job, attemptNo, attempt?.id, msg, false);
  }
}

async function markSuccess(job: SystemJob, attemptNo: number, attemptId: number | undefined) {
  const finishedAt = new Date().toISOString();
  if (attemptId) {
    await supabaseAdmin
      .from('system_job_attempts')
      .update({ finished_at: finishedAt, success: true })
      .eq('id', attemptId);
  }
  await supabaseAdmin
    .from('system_jobs')
    .update({
      status: 'SUCCEEDED',
      attempts: attemptNo,
      locked_at: null,
      locked_by: null,
      last_error: null,
    })
    .eq('id', job.id);
}

async function markFailure(
  job: SystemJob,
  attemptNo: number,
  attemptId: number | undefined,
  errorMessage: string,
  forceDeadAlways: boolean
) {
  const finishedAt = new Date().toISOString();
  if (attemptId) {
    await supabaseAdmin
      .from('system_job_attempts')
      .update({ finished_at: finishedAt, success: false, error_message: errorMessage })
      .eq('id', attemptId);
  }

  const isDead = forceDeadAlways || attemptNo >= job.max_attempts;
  if (isDead) {
    await supabaseAdmin
      .from('system_jobs')
      .update({
        status: 'DEAD',
        attempts: attemptNo,
        locked_at: null,
        locked_by: null,
        last_error: errorMessage,
      })
      .eq('id', job.id);
    console.error(`[job DEAD] #${job.id} ${job.job_type}: ${errorMessage}`);
  } else {
    const nextAvailable = new Date(Date.now() + backoffSec(attemptNo) * 1000).toISOString();
    await supabaseAdmin
      .from('system_jobs')
      .update({
        status: 'PENDING',
        attempts: attemptNo,
        locked_at: null,
        locked_by: null,
        last_error: errorMessage,
        available_at: nextAvailable,
      })
      .eq('id', job.id);
  }
}

/** Cron-аас дуудах гол entry — нэг тиктэнд хязгаарлагдсан тооны job-ыг боловсруулна. */
export async function processBatch(limit = 10): Promise<{ processed: number; succeeded: number; failed: number; reclaimed: number }> {
  const reclaimed = await reclaimStuckJobs(10);
  const jobs = await claimNextJobs(limit);
  let succeeded = 0;
  let failed = 0;
  for (const job of jobs) {
    try {
      await runJob(job);
      // succeeded if status is SUCCEEDED — тооцох хэрэгтэй бол re-fetch
      succeeded++;
    } catch (e) {
      failed++;
      console.error('[processBatch] uncaught', job.id, e);
    }
  }
  return { processed: jobs.length, succeeded, failed, reclaimed };
}

/** DEAD job-ыг гар reset хийх (admin retry товчоор) */
export async function retryDeadJob(jobId: number): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from('system_jobs')
    .update({
      status: 'PENDING',
      attempts: 0,
      available_at: new Date().toISOString(),
      last_error: null,
    })
    .eq('id', jobId)
    .eq('status', 'DEAD');
  if (error) {
    console.error('[retryDeadJob]', error.message);
    return false;
  }
  return true;
}
