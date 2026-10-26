// BankSmsStore-ийн Supabase (service_role) хэрэгжүүлэлт.
// Бүх утгыг PostgREST-ийн параметрээр дамжуулна — SMS-ийн текст SQL-д
// хэзээ ч нийлэхгүй. Давхардлыг DB-ийн unique index (23505) шийднэ.

import { supabaseAdmin } from '@/app/lib/supabase-admin';
import type {
  BankSmsStore, DeviceConfig, MappingRow, OpenInvoice, ResidentCandidate, StoredEvent,
} from './core';

const UNIQUE_VIOLATION = '23505';

export interface DeviceRow {
  id: number;
  sokh_id: number;
  display_name: string;
  bank: string;
  allowed_senders: string[] | null;
  account_mask: string | null;
  auto_apply: boolean;
  status: string;
}

export function toDeviceConfig(d: DeviceRow): DeviceConfig {
  return {
    id: d.id,
    sokhId: d.sokh_id,
    bank: d.bank,
    allowedSenders: d.allowed_senders || [],
    accountMask: d.account_mask,
    autoApply: d.auto_apply,
  };
}

export const supabaseBankSmsStore: BankSmsStore = {
  async insertEvent(row) {
    const { data, error } = await supabaseAdmin
      .from('bank_sms_events')
      .insert(row)
      .select('id')
      .single();
    if (!error && data) return { inserted: true, id: data.id as number };
    if (error?.code !== UNIQUE_VIOLATION) throw new Error(`event_insert: ${error?.message}`);

    const { data: existing, error: e2 } = await supabaseAdmin
      .from('bank_sms_events')
      .select('id, processing_status, transaction_id, retry_count')
      .eq('device_id', row.device_id)
      .eq('source_message_id', row.source_message_id)
      .single();
    if (e2 || !existing) throw new Error(`event_lookup: ${e2?.message}`);
    // Хэдэн удаа давтагдсаныг хяналтад тоолно. Алдаа нь хариуг өөрчлөхгүй.
    const { error: e3 } = await supabaseAdmin
      .from('bank_sms_events')
      .update({ retry_count: Number(existing.retry_count || 0) + 1 })
      .eq('id', existing.id);
    if (e3) console.error('[bank-sms] retry_count:', e3.message);
    return { inserted: false, existing: existing as StoredEvent };
  },

  async updateEvent(id, patch) {
    const { error } = await supabaseAdmin
      .from('bank_sms_events')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw new Error(`event_update: ${error.message}`);
  },

  async insertTransaction(row) {
    const { data, error } = await supabaseAdmin
      .from('bank_transactions')
      .insert(row)
      .select('id')
      .single();
    if (!error && data) return { inserted: true, id: data.id as number };
    if (error?.code !== UNIQUE_VIOLATION) throw new Error(`tx_insert: ${error?.message}`);

    // Reference-ийн index-ээр мөргөлдсөн байж болно — хоёуланг нь шалгана
    let q = supabaseAdmin.from('bank_transactions').select('id').eq('sokh_id', row.sokh_id);
    q = row.transaction_reference
      ? q.eq('account_reference', row.account_reference).eq('transaction_reference', row.transaction_reference)
      : q.eq('idempotency_key', row.idempotency_key);
    const { data: existing, error: e2 } = await q.limit(1).maybeSingle();
    if (e2 || !existing) throw new Error(`tx_lookup: ${e2?.message || 'not found'}`);
    return { inserted: false, existingId: existing.id as number };
  },

  async findActiveMapping(sokhId, normalizedPattern) {
    const { data, error } = await supabaseAdmin
      .from('payment_reference_mappings')
      .select('id, building_number, entrance_number, apartment_number')
      .eq('sokh_id', sokhId)
      .eq('normalized_pattern', normalizedPattern)
      .eq('is_active', true)
      .maybeSingle();
    if (error) throw new Error(`mapping_lookup: ${error.message}`);
    return (data as MappingRow | null) ?? null;
  },

  async findResidents(sokhId, building, apartment) {
    const { data, error } = await supabaseAdmin
      .from('residents')
      .select('id, floor, pending_claim')
      .eq('sokh_id', sokhId)
      .eq('building', building)
      .eq('apartment', apartment)
      .limit(20);
    if (error) throw new Error(`resident_lookup: ${error.message}`);
    return (data as ResidentCandidate[]) || [];
  },

  async findOpenInvoices(sokhId, residentId) {
    const { data, error } = await supabaseAdmin
      .from('invoices')
      .select('id, amount, previous_balance, total_amount, paid_amount, status')
      .eq('sokh_id', sokhId)
      .eq('resident_id', residentId)
      .in('status', ['pending', 'overdue', 'partial'])
      .limit(24);
    if (error) throw new Error(`invoice_lookup: ${error.message}`);
    return (data as OpenInvoice[]) || [];
  },

  async updateUnresolvedTransaction(id, patch) {
    const { error } = await supabaseAdmin
      .from('bank_transactions')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('reconciliation_status', 'needs_review')
      .is('payment_id', null);
    if (error) throw new Error(`tx_update: ${error.message}`);
  },

  async applyPayment({ transactionId, residentId, invoiceId, adminId, mode, note }) {
    const { data, error } = await supabaseAdmin.rpc('bank_sms_apply_payment', {
      p_transaction_id: transactionId,
      p_resident_id: residentId,
      p_invoice_id: invoiceId,
      p_admin_id: adminId,
      p_mode: mode,
      p_note: note ?? null,
    });
    if (error) throw new Error(error.message);
    return Number(data);
  },
};

export async function loadDeviceByTokenHash(tokenHash: string): Promise<DeviceRow | null> {
  const { data, error } = await supabaseAdmin
    .from('bank_sms_devices')
    .select('id, sokh_id, display_name, bank, allowed_senders, account_mask, auto_apply, status')
    .eq('token_hash', tokenHash)
    .maybeSingle();
  if (error) throw new Error(`device_lookup: ${error.message}`);
  return (data as DeviceRow | null) ?? null;
}

export async function touchDevice(id: number, patch: Record<string, unknown>): Promise<void> {
  const { error } = await supabaseAdmin
    .from('bank_sms_devices')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) console.error('[bank-sms] device touch:', error.message);
}
