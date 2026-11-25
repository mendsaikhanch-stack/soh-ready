// ICTown #2694 — cron-ийн 1-р алхам (энэ сарын нэхэмжлэх) шинээр хэнд нэхэмжлэх үүсгэхийг дуурайна (бичихгүй)
import fs from 'fs'; import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { UNIT_SCHEMES, isValidSchemeUnit } from '../app/lib/bank-sms/unit-address.ts';
for (const l of fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8').split('\n')) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) { let v = m[2].trim(); if (/^["'].*["']$/.test(v)) v = v.slice(1, -1); process.env[m[1]] ??= v; } }
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const pages = async (q: () => any) => { const all: any[] = []; for (let f = 0; ; f += 1000) { const { data, error } = await q().range(f, f + 999); if (error) throw error; all.push(...data); if (data.length < 1000) return all; } };
const res = await pages(() => sb.from('residents').select('id,name,building,apartment,monthly_fee').eq('sokh_id', 2694).eq('pending_claim', false).order('id'));
const oct = new Set((await pages(() => sb.from('invoices').select('resident_id').eq('sokh_id', 2694).eq('year', 2026).eq('month', 10).order('id'))).map(i => i.resident_id));
const nov = new Set((await pages(() => sb.from('invoices').select('resident_id').eq('sokh_id', 2694).eq('year', 2026).eq('month', 11).order('id'))).map(i => i.resident_id));
const scheme = (UNIT_SCHEMES as any)[2694]; const by = new Map<string, any>();
for (const r of res) { if (!isValidSchemeUnit(scheme, r.building, r.apartment)) continue; const k = `${r.building}-${String(r.apartment).trim()}`; const c = by.get(k);
  if (!c || (oct.has(r.id) && !oct.has(c.id)) || (oct.has(r.id) === oct.has(c.id) && r.id < c.id)) by.set(k, r); }
const missing = [...by.values()].filter(r => !nov.has(r.id));
const notChosen = [...nov].filter(id => ![...by.values()].some(r => r.id === id));
console.log('billable units:', by.size, ' would get NEW Nov invoice:', missing.length, ' Nov-invoiced rows not chosen as unit row:', notChosen.length);
console.table(missing.map(r => ({ id: r.id, b: r.building, apt: r.apartment, fee: r.monthly_fee, octInv: oct.has(r.id) })));
