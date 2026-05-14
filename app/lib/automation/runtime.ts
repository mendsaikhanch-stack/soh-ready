// Khotol Automation Runtime
// ============================================================
// Энэхүү файл нь Layer 1 — Rule Engine-ийн scanner логик. AI бус,
// зөвхөн адаптер дуудаж draft үүсгэнэ.
//
// Зорилго:
//   1. automation_rules дотроос status='active' дүрмүүдийг олох
//   2. Trigger тус бүрт data-adapters.ts-аас input татна
//   3. Template prompt-аар draft үүсгэх (Layer 2)
//   4. automation_runs-д idempotency_key-тэйгээр бичих
//   5. reviewed_status = 'pending_review' — Админ заавал шалгана
//
// SCHEMA RULE:
//   Бүх DB query логик нь `app/lib/ai/data-adapters.ts` дотор амьдарна.
//   Энэ файл нь зөвхөн adapter-ийг дуудаж, prompt-аар хувиргаж, run
//   бичлэг үүсгэнэ. Хүснэгт rename хийгдэх / шинэ field нэмэгдэх ажил
//   нь зөвхөн data-adapters.ts-д тусгагдана.

import { supabaseAdmin } from '@/app/lib/supabase-admin';
import type {
  AutomationRule,
  ActionType,
} from '@/app/api/admin/workflows/route';
import {
  templateDebtReminder,
  templateIssueInsight,
  templateMonthlyInsight,
  templateBoardReport,
  templateFinancialReport,
} from '@/app/lib/ai/prompts/soh-operations';
import { getAdapterInput, type AdapterKind } from '@/app/lib/ai/data-adapters';

// ============================================================
// Идэмпотентн түлхүүр build
// ============================================================

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}
function todayUtc(): Date {
  return new Date();
}
function ym(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
}
function ymd(d: Date): string {
  return `${ym(d)}-${pad(d.getUTCDate())}`;
}

function buildIdempotencyKey(rule: AutomationRule, now: Date): string | null {
  switch (rule.trigger_type) {
    case 'monthly_date':
      return `monthly:${rule.id}:${ym(now)}`;
    case 'unpaid_after_day':
      return `unpaid:${rule.id}:${ym(now)}`;
    case 'issue_overdue':
      return `issue_overdue:${rule.id}:${ymd(now)}`;
    case 'manual':
      return null;
  }
}

// ============================================================
// Trigger gate — өнөөдөр энэ дүрмийг ажиллуулах ёстой юу?
// ============================================================

function shouldRunByCalendar(rule: AutomationRule, now: Date): boolean {
  const cond = (rule.condition_json || {}) as { day?: number; hours?: number };
  switch (rule.trigger_type) {
    case 'monthly_date': {
      const day = Number(cond.day) || 1;
      return now.getUTCDate() === day;
    }
    case 'unpaid_after_day': {
      const day = Number(cond.day) || 15;
      return now.getUTCDate() >= day;
    }
    case 'issue_overdue':
      return true;
    case 'manual':
      return false;
  }
}

// ============================================================
// action_type → AdapterKind + template func
// ============================================================
// Action тус бүр аль adapter-ийг дуудаж, аль template-р дүрэх вэ.
// Энд DB query огт байхгүй — бүгд adapter-аар дамждаг.

function actionToAdapterKind(action: ActionType, rule: AutomationRule): AdapterKind {
  switch (action) {
    case 'create_reminder_draft':
    case 'create_notification_draft':
      return 'debt_reminder';
    case 'create_report_draft': {
      // rule.name-д "зөвлөл"/"board" гэсэн үг байвал board_report, үгүй бол monthly_insight
      const wantsBoard =
        (rule.name || '').toLowerCase().includes('board') ||
        (rule.name || '').includes('зөвлөл');
      return wantsBoard ? 'board_report' : 'monthly_insight';
    }
    case 'alert_admin':
      return 'issue_insight';
    case 'create_invoice_batch_draft':
      return 'financial_report';
  }
}

function templateFor(kind: AdapterKind, input: unknown): unknown {
  switch (kind) {
    case 'debt_reminder':
      return templateDebtReminder(input as Parameters<typeof templateDebtReminder>[0]);
    case 'financial_report':
      return templateFinancialReport(input as Parameters<typeof templateFinancialReport>[0]);
    case 'monthly_insight':
      return templateMonthlyInsight(input as Parameters<typeof templateMonthlyInsight>[0]);
    case 'issue_insight':
      return templateIssueInsight(input as Parameters<typeof templateIssueInsight>[0]);
    case 'board_report':
      return templateBoardReport(input as Parameters<typeof templateBoardReport>[0]);
  }
}

// ============================================================
// Single rule run
// ============================================================

export interface RunOutcome {
  ruleId: number;
  status: 'success' | 'skipped' | 'failed';
  runId?: number;
  reason?: string;
  idempotencyKey?: string | null;
  source?: 'real' | 'demo' | 'empty';
}

export async function runRule(
  rule: AutomationRule,
  opts: { mode: 'manual' | 'cron'; now?: Date } = { mode: 'manual' },
): Promise<RunOutcome> {
  const now = opts.now ?? todayUtc();

  if (opts.mode === 'cron' && !shouldRunByCalendar(rule, now)) {
    return { ruleId: rule.id, status: 'skipped', reason: 'calendar gate' };
  }

  const idempotencyKey = opts.mode === 'cron' ? buildIdempotencyKey(rule, now) : null;

  if (idempotencyKey) {
    const { data: existing } = await supabaseAdmin
      .from('automation_runs')
      .select('id, status')
      .eq('rule_id', rule.id)
      .eq('idempotency_key', idempotencyKey)
      .in('status', ['pending', 'success'])
      .maybeSingle();
    if (existing) {
      return {
        ruleId: rule.id,
        status: 'skipped',
        reason: `existing run ${existing.id}`,
        idempotencyKey,
      };
    }
  }

  try {
    const kind = actionToAdapterKind(rule.action_type, rule);
    const monthLabel = ym(now);
    const adapter = await getAdapterInput(kind, {
      sokhId: rule.sokh_id,
      month: monthLabel,
    });

    const output = templateFor(kind, adapter.input);

    const { data: inserted, error: insErr } = await supabaseAdmin
      .from('automation_runs')
      .insert({
        rule_id: rule.id,
        sokh_id: rule.sokh_id,
        status: 'success',
        input_json: adapter.input as unknown as Record<string, unknown>,
        output_json: {
          kind,
          output,
          source: adapter.source,
          notes: adapter.notes,
        },
        idempotency_key: idempotencyKey,
        reviewed_status: 'pending_review',
      })
      .select('id')
      .single();

    if (insErr || !inserted) {
      return {
        ruleId: rule.id,
        status: 'failed',
        reason: insErr?.message || 'insert failed',
        idempotencyKey,
        source: adapter.source,
      };
    }

    return {
      ruleId: rule.id,
      status: 'success',
      runId: inserted.id as number,
      idempotencyKey,
      source: adapter.source,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    try {
      await supabaseAdmin.from('automation_runs').insert({
        rule_id: rule.id,
        sokh_id: rule.sokh_id,
        status: 'failed',
        error_message: msg,
        idempotency_key: idempotencyKey,
        reviewed_status: 'pending_review',
      });
    } catch {
      // лог алдаа гарсан ч caller-д буцаах хариуг саатуулахгүй
    }
    return {
      ruleId: rule.id,
      status: 'failed',
      reason: msg,
      idempotencyKey,
    };
  }
}

// ============================================================
// Scan active rules (cron entry point)
// ============================================================

export interface ScanResult {
  scanned: number;
  succeeded: number;
  skipped: number;
  failed: number;
  details: RunOutcome[];
}

export async function scanActiveRules(
  opts: {
    triggerTypes?: Array<'monthly_date' | 'unpaid_after_day' | 'issue_overdue' | 'manual'>;
    sokhId?: number;
    now?: Date;
  } = {},
): Promise<ScanResult> {
  let q = supabaseAdmin
    .from('automation_rules')
    .select('*')
    .eq('status', 'active')
    .limit(500);

  if (opts.triggerTypes && opts.triggerTypes.length > 0) {
    q = q.in('trigger_type', opts.triggerTypes);
  } else {
    q = q.in('trigger_type', ['monthly_date', 'unpaid_after_day', 'issue_overdue']);
  }
  if (opts.sokhId) q = q.eq('sokh_id', opts.sokhId);

  const { data: rules, error } = await q;
  if (error) {
    return { scanned: 0, succeeded: 0, skipped: 0, failed: 1, details: [] };
  }

  const list = (rules || []) as AutomationRule[];
  const results: RunOutcome[] = [];

  for (const rule of list) {
    const r = await runRule(rule, { mode: 'cron', now: opts.now });
    results.push(r);
  }

  return {
    scanned: results.length,
    succeeded: results.filter((r) => r.status === 'success').length,
    skipped: results.filter((r) => r.status === 'skipped').length,
    failed: results.filter((r) => r.status === 'failed').length,
    details: results,
  };
}
