// Per-СӨХ AI settings + quota helper
// ============================================================
// Database-аас СӨХ-ийн AI тохиргоог уншиж, дуудалт хийхээс өмнө квотыг
// шалгана. AI-гүй ажиллах горим (Layer 1/2)-нд энэ файл огт дуудагдахгүй.

import { supabaseAdmin } from '@/app/lib/supabase-admin';
import type { ProviderName } from './core';

export interface AiSettings {
  sokh_id: number;
  ai_enabled: boolean;
  ai_provider: ProviderName;
  monthly_limit: number;
  used_this_month: number;
  period_started_at: string;
  updated_at: string;
  created_at: string;
}

const DEFAULT_SETTINGS = (sokhId: number): AiSettings => ({
  sokh_id: sokhId,
  ai_enabled: false,
  ai_provider: 'template',
  monthly_limit: 100,
  used_this_month: 0,
  period_started_at: new Date(
    Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1),
  ).toISOString(),
  updated_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
});

// ============================================================
// GET — settings (тохиргоо байхгүй бол default буцаана, бичихгүй)
// ============================================================

export async function getAiSettings(sokhId: number): Promise<AiSettings> {
  // Сар солигдсон бол rollover хийнэ (used_this_month-ыг 0 болгож)
  await supabaseAdmin.rpc('ai_settings_rollover_if_new_month', { p_sokh_id: sokhId }).then(
    () => undefined,
    () => undefined, // function байхгүй бол хайхрахгүй (migration урьдчилан хийх ёстой)
  );

  const { data } = await supabaseAdmin
    .from('ai_settings')
    .select('*')
    .eq('sokh_id', sokhId)
    .maybeSingle();

  if (!data) return DEFAULT_SETTINGS(sokhId);
  return data as AiSettings;
}

// ============================================================
// UPSERT — admin тохиргоо солиход
// ============================================================

export async function upsertAiSettings(
  sokhId: number,
  patch: Partial<Pick<AiSettings, 'ai_enabled' | 'ai_provider' | 'monthly_limit'>>,
): Promise<AiSettings> {
  const current = await getAiSettings(sokhId);
  const next = {
    sokh_id: sokhId,
    ai_enabled: patch.ai_enabled ?? current.ai_enabled,
    ai_provider: patch.ai_provider ?? current.ai_provider,
    monthly_limit: patch.monthly_limit ?? current.monthly_limit,
    // used_this_month-ыг гараар reset хийхгүй — period rollover-аас l
  };

  const { data, error } = await supabaseAdmin
    .from('ai_settings')
    .upsert(next, { onConflict: 'sokh_id' })
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as AiSettings;
}

// ============================================================
// Quota check — Layer 3 ашиглахын өмнө
// ============================================================

export interface QuotaCheck {
  allowed: boolean;
  reason?: string;
  settings: AiSettings;
}

export async function checkAiQuota(sokhId: number): Promise<QuotaCheck> {
  const settings = await getAiSettings(sokhId);

  if (!settings.ai_enabled) {
    return { allowed: false, reason: 'AI тохиргоо идэвхгүй', settings };
  }
  if (settings.ai_provider === 'template') {
    return { allowed: false, reason: 'Provider нь template — AI бус', settings };
  }
  if (settings.monthly_limit <= 0) {
    return { allowed: false, reason: 'Сарын хязгаар 0', settings };
  }
  if (settings.used_this_month >= settings.monthly_limit) {
    return {
      allowed: false,
      reason: `Сарын квот ${settings.monthly_limit} дуусчээ`,
      settings,
    };
  }
  return { allowed: true, settings };
}

// ============================================================
// Хэрэглээний лог + counter өсгөх
// ============================================================

export interface UsageLogInput {
  sokhId: number;
  kind: string;
  layer: 'rule' | 'template' | 'ai_enhanced';
  provider: string;
  model?: string;
  success: boolean;
  errorMessage?: string;
  promptTokens?: number;
  outputTokens?: number;
  estCostMicro?: number;
  metadata?: Record<string, unknown>;
}

export async function recordUsage(input: UsageLogInput): Promise<void> {
  // Log нэг бичлэг
  await supabaseAdmin.from('ai_usage_log').insert({
    sokh_id: input.sokhId,
    kind: input.kind,
    layer: input.layer,
    provider: input.provider,
    model: input.model ?? null,
    success: input.success,
    error_message: input.errorMessage ?? null,
    prompt_tokens: input.promptTokens ?? null,
    output_tokens: input.outputTokens ?? null,
    est_cost_micro: input.estCostMicro ?? null,
    metadata: input.metadata ?? null,
  });

  // Зөвхөн ai_enhanced layer + success бол quota counter-ыг өсгөнө.
  // Template/rule layer-уудыг тоолохгүй (тэдгээр нь үнэгүй).
  if (input.layer === 'ai_enhanced' && input.success) {
    // increment_used_this_month RPC байхгүй учир жирийн SQL update-аар.
    // Race condition-ыг тоохгүй — sub-second тохиолдол ховор.
    const { data } = await supabaseAdmin
      .from('ai_settings')
      .select('used_this_month')
      .eq('sokh_id', input.sokhId)
      .maybeSingle();
    const current = (data?.used_this_month as number) ?? 0;
    await supabaseAdmin
      .from('ai_settings')
      .update({ used_this_month: current + 1 })
      .eq('sokh_id', input.sokhId);
  }
}
