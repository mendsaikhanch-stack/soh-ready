// Хотол → СӨХ-ийн нэхэмжлэхийн АВТОМАТ сануулга.
//
// Яагаад: супер админы самбарт хэтэрсэн нэхэмжлэх ярайж харагдаад л байдаг,
// харин хэн ч сануулдаггүй. Энэ модуль өдөр бүр (cron) төлөгдөөгүй нэхэмжлэх
// бүрийг шалгаж, доорх ШАТ бүрд НЭГ Л УДАА даргад SMS + имэйл илгээнэ:
//
//   soon      — төлөх хугацаа 7 хоногийн дотор дөхлөө
//   today     — өнөөдөр төлөх ёстой
//   late_3    — 3 хоног хэтэрлээ
//   late_10   — 10 хоног
//   late_20   — 20 хоног
//   notice_30 — 30 хоног: гэрээний босго → супер админд ч имэйл (бичгээр мэдэгдэх)
//   late_45 / late_60 — цааш нь 15 хоног тутам
//
// Давтагдахгүй байх баталгаа: platform_invoice_reminders(invoice_id, stage) UNIQUE.
// Cron нэг өдөр хэд дуудагдсан ч, эсвэл хэд хоног алгассан ч зөвхөн ОДООГИЙН
// шатыг илгээнэ — хоцорсон шатуудыг цувуулж явуулахгүй.
//
// Хоногийг ЗААВАЛ `due_date`-ээс, Улаанбаатарын өдрөөр тоолно (ubDay).

import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { isDemoSokh } from '@/app/lib/demo-orgs';
import { sendSms } from '@/app/lib/sms';
import { sendEmail, SUPERADMIN_EMAIL } from '@/app/lib/email';
import { PROVIDER } from '@/app/lib/contract/service-agreement';
import { daysBetweenUb, OVERDUE_NOTICE_DAYS } from '@/app/lib/platform-pricing';

export interface ReminderStage {
  key: string;
  /** Энэ шат идэвхжих хоног: daysLeft <= atDaysLeft (сөрөг = хэтэрсэн) */
  atDaysLeft: number;
  label: string;
}

export const REMINDER_STAGES: ReminderStage[] = [
  { key: 'soon', atDaysLeft: 7, label: 'Хугацаа дөхлөө' },
  { key: 'today', atDaysLeft: 0, label: 'Өнөөдөр төлөх' },
  { key: 'late_3', atDaysLeft: -3, label: '3 хоног хэтэрсэн' },
  { key: 'late_10', atDaysLeft: -10, label: '10 хоног хэтэрсэн' },
  { key: 'late_20', atDaysLeft: -20, label: '20 хоног хэтэрсэн' },
  { key: 'notice_30', atDaysLeft: -OVERDUE_NOTICE_DAYS, label: '30 хоног — бичгээр мэдэгдэх' },
  { key: 'late_45', atDaysLeft: -45, label: '45 хоног хэтэрсэн' },
  { key: 'late_60', atDaysLeft: -60, label: '60 хоног хэтэрсэн' },
];

export const stageLabel = (key: string) =>
  REMINDER_STAGES.find(s => s.key === key)?.label || key;

/** Өнөөдрийн байдлаар идэвхтэй байх ёстой шат (хамгийн сүүлийнх нь). null = хол байна. */
export function dueStage(daysLeft: number): ReminderStage | null {
  let stage: ReminderStage | null = null;
  for (const s of REMINDER_STAGES) {
    if (daysLeft <= s.atDaysLeft) stage = s;
  }
  return stage;
}

export interface ChannelResult {
  channel: 'sms' | 'email';
  to: string;
  ok: boolean;
  /** 'stub' = провайдер/SMTP холбогдоогүй, зөвхөн console-д хэвлэсэн */
  note?: string;
}

export interface ReminderRunResult {
  ok: boolean;
  /** Миграц ажиллаагүй (хүснэгт байхгүй) бол false */
  migrated: boolean;
  checked: number;
  sent: { invoice_id: number; sokh_id: number; name: string; stage: string; channels: ChannelResult[] }[];
  markedOverdue: number;
  errors: string[];
}

const kindLabel = (kind: string) => (kind === 'setup' ? 'суурилуулалтын төлбөр' : 'сарын хураамж');
const fmtDate = (ymd: string) => ymd.replace(/-/g, '.');
const money = (n: number) => `${Math.round(n).toLocaleString('en-US')}₮`;

/** Монголын гар утас: 8 оронтой, 5/6/8/9-өөр эхэлнэ. 7xxxxxxx = суурин, SMS хүрэхгүй. */
const digits = (s: string) => s.replace(/\D/g, '');
const isMobile = (s: string | null | undefined) => !!s && /^[5689]\d{7}$/.test(digits(s));

export function buildReminderMessage(input: {
  orgName: string;
  kind: string;
  amount: number;
  dueOn: string;
  daysLeft: number;
  stage: ReminderStage;
}): { sms: string; subject: string; text: string } {
  const { orgName, kind, amount, dueOn, daysLeft, stage } = input;
  const late = -daysLeft;

  // Текстийг шатаас биш БОДИТ хоногоос сонгоно — cron нэг өдөр алгасвал
  // «today» шат 1 хоног хоцорч явах бөгөөд «өнөөдөр» гэж бичих нь буруу.
  let when: string;
  if (daysLeft > 0) when = `Төлөх хугацаа ${daysLeft} хоногийн дараа (${fmtDate(dueOn)}).`;
  else if (daysLeft === 0) when = `Төлөх хугацаа ӨНӨӨДӨР (${fmtDate(dueOn)}).`;
  else if (stage.key === 'notice_30')
    when =
      `Төлөх хугацаа ${late} хоног хэтэрлээ (${fmtDate(dueOn)}). ` +
      `Үйлчилгээний гэрээний дагуу ${OVERDUE_NOTICE_DAYS} хоногоос дээш хэтэрсэн тул энэхүү мэдэгдлийг бичгээр хүргэж байна. ` +
      `Төлбөр төлөгдөхгүй бол үйлчилгээг түр зогсоох эрх Гүйцэтгэгчид үүснэ.`;
  else when = `Төлөх хугацаа ${late} хоног хэтэрлээ (${fmtDate(dueOn)}).`;

  const bank = `${PROVIDER.bank} банк ${PROVIDER.bankAccount} (${PROVIDER.bankAccountHolder})`;
  const head = `Хотол: ${orgName} СӨХ-ийн ${kindLabel(kind)} ${money(amount)}.`;

  const sms = `${head} ${when} Данс: ${bank}. Гүйлгээний утга: ${orgName}. Асуулт: ${PROVIDER.phone}`;
  const subject = `Хотол — ${stage.label}: ${orgName} СӨХ, ${money(amount)}`;
  const text =
    `${orgName} СӨХ-ийн дарга танаа,\n\n` +
    `${head}\n${when}\n\n` +
    `Төлөх данс: ${bank}\nГүйлгээний утга: ${orgName}\n\n` +
    `Төлсний дараа энэ мэдэгдэл автоматаар зогсоно. Асуулт байвал ${PROVIDER.phone} (${PROVIDER.email}).\n\n` +
    `${PROVIDER.company} · ${PROVIDER.website}`;

  return { sms, subject, text };
}

interface OpenInvoice {
  id: number;
  sokh_id: number;
  kind: string;
  amount: number;
  status: string;
  due_date: string;
}

/** Бүх төлөгдөөгүй нэхэмжлэхийг шалгаж, шаардлагатай сануулгыг илгээнэ. */
export async function runInvoiceReminders(now: Date = new Date()): Promise<ReminderRunResult> {
  const result: ReminderRunResult = { ok: true, migrated: true, checked: 0, sent: [], markedOverdue: 0, errors: [] };

  const { data: invoices, error } = await supabaseAdmin
    .from('platform_invoices')
    .select('id, sokh_id, kind, amount, status, due_date')
    .not('status', 'in', '("paid","cancelled")');
  if (error) {
    result.ok = false;
    result.errors.push(`Нэхэмжлэх уншиж чадсангүй: ${error.message}`);
    return result;
  }

  const rows = ((invoices || []) as OpenInvoice[]).filter(
    i => !isDemoSokh(Number(i.sokh_id)) && i.due_date && Number(i.amount) > 0
  );
  result.checked = rows.length;
  if (!rows.length) return result;

  // Илгээсэн шатууд — давхардахгүй байх үндсэн шалгуур
  const ids = rows.map(i => Number(i.id));
  const { data: sentRows, error: sentErr } = await supabaseAdmin
    .from('platform_invoice_reminders')
    .select('invoice_id, stage')
    .in('invoice_id', ids);
  if (sentErr) {
    // Хүснэгт байхгүй (миграц ажиллаагүй). Юу ч илгээхгүй — бүртгэлгүй
    // илгээвэл маргааш дахин илгээгдэнэ.
    result.ok = false;
    result.migrated = false;
    result.errors.push(
      'platform_invoice_reminders хүснэгт байхгүй — supabase-invoice-reminders-migration.sql ажиллуулна уу'
    );
    return result;
  }
  const already = new Set((sentRows || []).map(r => `${r.invoice_id}:${r.stage}`));

  // Аль шат нь илгээгдэх ёстойг эхлээд тодорхойлно — СӨХ-ийн мэдээллийг
  // зөвхөн хэрэгтэй үед нь уншина.
  const pending: { inv: OpenInvoice; daysLeft: number; stage: ReminderStage }[] = [];
  for (const inv of rows) {
    const due = new Date(`${inv.due_date}T00:00:00+08:00`);
    if (isNaN(due.getTime())) continue;
    const daysLeft = daysBetweenUb(due, now);

    // Хугацаа хэтэрсэн нэхэмжлэхийн төлөвийг «overdue» болгоно — орлогын
    // хуудас энэ төлвөөр ялгаж харуулдаг. Төлсөнд тэмдэглэхэд 'paid' болно.
    if (daysLeft < 0 && inv.status === 'pending') {
      const { error: upErr } = await supabaseAdmin
        .from('platform_invoices')
        .update({ status: 'overdue' })
        .eq('id', inv.id)
        .eq('status', 'pending');
      if (!upErr) result.markedOverdue++;
    }

    const stage = dueStage(daysLeft);
    if (!stage) continue;
    if (already.has(`${inv.id}:${stage.key}`)) continue;
    pending.push({ inv, daysLeft, stage });
  }
  if (!pending.length) return result;

  const sokhIds = [...new Set(pending.map(p => Number(p.inv.sokh_id)))];
  const [{ data: orgs }, { data: admins }] = await Promise.all([
    supabaseAdmin.from('sokh_organizations').select('id, name, phone, contact_email').in('id', sokhIds),
    supabaseAdmin
      .from('admin_users')
      .select('sokh_id, username, role, status')
      .in('sokh_id', sokhIds)
      .eq('role', 'admin')
      .eq('status', 'active'),
  ]);
  type OrgInfo = { name: string; phone: string | null; contact_email: string | null };
  const orgById = new Map<number, OrgInfo>(
    (orgs || []).map(o => [
      Number(o.id),
      { name: String(o.name), phone: o.phone as string | null, contact_email: o.contact_email as string | null },
    ])
  );

  for (const { inv, daysLeft, stage } of pending) {
    const sokhId = Number(inv.sokh_id);
    const org = orgById.get(sokhId);
    const orgName = org?.name || `СӨХ #${sokhId}`;
    const msg = buildReminderMessage({
      orgName,
      kind: String(inv.kind || 'monthly'),
      amount: Number(inv.amount),
      dueOn: String(inv.due_date),
      daysLeft,
      stage,
    });

    // Хүлээн авагч: даргын нэвтрэх утас (username = гар утас) + СӨХ-ийн утас
    const phones = new Set<string>();
    for (const a of admins || []) {
      if (Number(a.sokh_id) === sokhId && isMobile(String(a.username))) phones.add(digits(String(a.username)));
    }
    if (org && isMobile(org.phone)) phones.add(digits(org.phone as string));

    const channels: ChannelResult[] = [];
    const smsStub = !process.env.SMS_PROVIDER;
    for (const to of phones) {
      const r = await sendSms(to, msg.sms);
      channels.push({ channel: 'sms', to, ok: r.ok, note: r.error || (smsStub ? 'stub' : undefined) });
    }
    const email = org?.contact_email?.trim();
    if (email && email.includes('@')) {
      const r = await sendEmail({ to: email, subject: msg.subject, text: msg.text });
      channels.push({ channel: 'email', to: email, ok: r.ok, note: r.error || (r.stub ? 'stub' : undefined) });
    }
    // 30 хоногийн босго — супер админд ч мэдэгдэнэ: гэрээний дагуу бичгээр
    // мэдэгдэх, түр зогсоох шийдвэр нь хүний ажил.
    if (stage.key === 'notice_30') {
      const delivered =
        channels
          .map(c => `${c.channel} ${c.to} ${c.ok ? 'OK' : 'алдаа'}${c.note ? ` (${c.note})` : ''}`)
          .join(', ') || 'хүлээн авагч олдсонгүй';
      const r = await sendEmail({
        to: SUPERADMIN_EMAIL,
        subject: `[Хотол] ${orgName} — ${OVERDUE_NOTICE_DAYS} хоног хэтэрлээ, бичгээр мэдэгдэх босго`,
        text:
          `${orgName} СӨХ-ийн ${kindLabel(String(inv.kind))} ${money(Number(inv.amount))} ` +
          `(${fmtDate(String(inv.due_date))} хүртэл) ${-daysLeft} хоног хэтэрлээ.\n\n` +
          `Даргад илгээсэн: ${delivered}\n\n` +
          `Гэрээний дагуу бичгээр мэдэгдэж, шаардлагатай бол үйлчилгээг түр зогсоох шийдвэр гаргана уу.\n` +
          `https://khotol.com/mng-ctrl/customers`,
      });
      channels.push({
        channel: 'email',
        to: SUPERADMIN_EMAIL,
        ok: r.ok,
        note: r.error || (r.stub ? 'stub' : 'superadmin'),
      });
    }

    const { error: insErr } = await supabaseAdmin.from('platform_invoice_reminders').insert({
      invoice_id: inv.id,
      sokh_id: sokhId,
      stage: stage.key,
      days_left: daysLeft,
      channels,
      message: msg.sms,
    });
    // 23505 = зэрэг ажилласан хоёр cron нэг шатыг давхар бичсэн — хэвийн
    if (insErr && insErr.code !== '23505') {
      result.errors.push(`#${inv.id} ${orgName}: ${insErr.message}`);
      continue;
    }
    result.sent.push({ invoice_id: Number(inv.id), sokh_id: sokhId, name: orgName, stage: stage.key, channels });
  }

  result.ok = result.errors.length === 0;
  return result;
}
