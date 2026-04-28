// System alerts — DEAD job, drift threshold, notif-dead зэрэг ноцтой
// нөхцөлд insert + (тохируулсан бол) Slack-compatible webhook.
// raiseAlert ХЭЗЭЭ Ч throw хийхгүй — caller-н primary flow-ыг буруутгахгүй.

import { supabaseAdmin } from '@/app/lib/supabase-admin';

export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface RaiseAlertInput {
  severity: AlertSeverity;
  source: string;                       // 'job:dead', 'reconcile:drift', 'notif:dead' ...
  message: string;
  payload?: Record<string, unknown>;
  /** Нэг асуудлаас олон алерт хуурайруулахгүй идэмпотент түлхүүр */
  dedupKey?: string;
}

/** Slack-compatible: `{ text }` POST. Хариу шалгахгүй, амжилтгүй бол silent. */
async function postWebhook(text: string): Promise<void> {
  const url = process.env.ALERT_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
      // Webhook өгөгдөх боломжгүй бол хурдан буцах
      signal: AbortSignal.timeout(5000),
    });
  } catch (e) {
    console.error('[alerts.postWebhook]', (e as Error).message);
  }
}

export async function raiseAlert(input: RaiseAlertInput): Promise<void> {
  const { severity, source, message, payload = {}, dedupKey } = input;
  try {
    // Идэмпотент: ижил dedup_key-тэй ack хийгдээгүй алерт байвал шинэ row үүсгэхгүй
    if (dedupKey) {
      const { data: existing } = await supabaseAdmin
        .from('system_alerts')
        .select('id')
        .eq('dedup_key', dedupKey)
        .is('acknowledged_at', null)
        .maybeSingle();
      if (existing) return;
    }

    const { error } = await supabaseAdmin
      .from('system_alerts')
      .insert([{ severity, source, message, payload, dedup_key: dedupKey || null }]);
    if (error) console.error('[raiseAlert insert]', error.message);

    // Webhook (env байвал)
    const prefix = severity === 'critical' ? '🚨' : severity === 'warning' ? '⚠️' : 'ℹ️';
    await postWebhook(`${prefix} [${source}] ${message}`);
  } catch (e) {
    console.error('[raiseAlert]', (e as Error).message);
  }
}

export async function acknowledgeAlert(id: number, by: string): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from('system_alerts')
    .update({ acknowledged_at: new Date().toISOString(), acknowledged_by: by })
    .eq('id', id)
    .is('acknowledged_at', null);
  if (error) {
    console.error('[acknowledgeAlert]', error.message);
    return false;
  }
  return true;
}
