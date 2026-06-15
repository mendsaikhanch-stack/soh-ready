'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ROLE_OPTIONS,
  CHANNEL_OPTIONS,
  PROBLEM_OPTIONS,
  RENTER_ISSUE_OPTIONS,
} from '@/app/lib/demo-requests/constants';

const YESNO = ['Тийм', 'Үгүй', 'Мэдэхгүй'];

export default function DemoRequestPage() {
  const [soh_name, setSohName] = useState('');
  const [city, setCity] = useState('Улаанбаатар');
  const [district, setDistrict] = useState('');
  const [khoroo, setKhoroo] = useState('');
  const [contact_name, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('');
  const [household, setHousehold] = useState('');
  const [channels, setChannels] = useState<string[]>([]);
  const [problems, setProblems] = useState<string[]>([]);
  const [hasFb, setHasFb] = useState('');
  const [hasExcel, setHasExcel] = useState('');
  const [renterIssue, setRenterIssue] = useState('');
  const [notes, setNotes] = useState('');
  const [suggestions, setSuggestions] = useState('');
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState(''); // honeypot

  const [utm, setUtm] = useState<{ utm_source?: string; utm_medium?: string; utm_campaign?: string }>({});

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<string | null>(null);

  // UTM параметрүүдийг URL-аас түүж эх сурвалжийг тэмдэглэнэ.
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUtm({
      utm_source: sp.get('utm_source') || undefined,
      utm_medium: sp.get('utm_medium') || undefined,
      utm_campaign: sp.get('utm_campaign') || undefined,
    });
  }, []);

  const toggle = (list: string[], setList: (v: string[]) => void, value: string) => {
    setList(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (soh_name.trim().length < 2) return setError('СӨХ / байрны нэрээ оруулна уу');
    if (!city.trim()) return setError('Хот / аймгаа оруулна уу');
    if (!district.trim()) return setError('Дүүрэг / сумаа оруулна уу');
    if (contact_name.trim().length < 2) return setError('Холбогдох хүний нэрээ оруулна уу');
    if (phone.replace(/\D/g, '').length < 6) return setError('Утасны дугаараа зөв оруулна уу');
    if (!consent) return setError('Мэдээлэл хадгалахыг зөвшөөрнө үү');

    setSubmitting(true);
    try {
      const res = await fetch('/api/demo-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          soh_name,
          city,
          district,
          khoroo,
          contact_name,
          phone,
          role,
          household_count: household,
          current_channels: channels,
          main_problems: problems,
          has_facebook_group: hasFb,
          has_excel: hasExcel,
          renter_issue_level: renterIssue,
          notes,
          improvement_suggestions: suggestions,
          consent,
          website_url: website,
          referrer: document.referrer,
          ...utm,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setDone(data.message || 'Баярлалаа. Таны хүсэлтийг хүлээн авлаа.');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        setError(data.error || 'Илгээхэд алдаа гарлаа. Дахин оролдоно уу.');
      }
    } catch {
      setError('Сервертэй холбогдож чадсангүй. Дахин оролдоно уу.');
    }
    setSubmitting(false);
  };

  if (done) {
    return (
      <div className="bg-gray-50 min-h-screen">
        <div className="max-w-xl mx-auto px-4 py-20 text-center">
          <div className="w-16 h-16 bg-green-100 text-green-600 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-5">✓</div>
          <h1 className="text-2xl font-bold mb-3">Хүсэлт хүлээн авлаа</h1>
          <p className="text-gray-600 mb-8">{done}</p>
          <Link href="/" className="inline-block bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-700 transition">
            Нүүр хуудас руу буцах
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Hero */}
      <section className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white">
        <div className="max-w-3xl mx-auto px-4 py-14 md:py-20 text-center">
          <h1 className="text-3xl md:text-4xl font-bold mb-3">Үнэгүй танилцуулга авах</h1>
          <p className="text-blue-100 max-w-xl mx-auto">
            Доорх товч судалгааг бөглөвөл манай талаас тантай холбогдож, Хотол систем таны СӨХ-д хэрхэн
            тус болохыг богино танилцуулгаар үзүүлнэ.
          </p>
        </div>
      </section>

      <section className="py-10 md:py-14">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto px-4 space-y-6">
          {/* Honeypot — хүн харахгүй, бот бөглөнө */}
          <input
            type="text"
            name="website_url"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            className="hidden"
          />

          {/* СӨХ мэдээлэл */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
            <h2 className="text-lg font-bold">СӨХ / Байрны мэдээлэл</h2>
            <Input label="СӨХ / байрны нэр" required value={soh_name} onChange={setSohName} placeholder="Жишээ: 25-р хороолол, 14-р байр СӨХ" />
            <div className="grid sm:grid-cols-2 gap-4">
              <Input label="Хот / аймаг" required value={city} onChange={setCity} />
              <Input label="Дүүрэг / сум" required value={district} onChange={setDistrict} />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <Input label="Хороо / баг" value={khoroo} onChange={setKhoroo} placeholder="Заавал биш" />
              <Input label="Өрхийн (тоотын) тоо" value={household} onChange={setHousehold} type="number" placeholder="Жишээ: 120" />
            </div>
          </div>

          {/* Холбоо барих */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
            <h2 className="text-lg font-bold">Холбоо барих</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <Input label="Таны нэр" required value={contact_name} onChange={setContactName} />
              <Input label="Утасны дугаар" required value={phone} onChange={setPhone} type="tel" placeholder="99XXXXXX" />
            </div>
            <div>
              <Label>Таны үүрэг</Label>
              <select value={role} onChange={(e) => setRole(e.target.value)} className={selectCls}>
                <option value="">Сонгох...</option>
                {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>

          {/* Судалгаа */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
            <h2 className="text-lg font-bold">Товч судалгаа</h2>

            <div>
              <Label>Одоо ямар сувгаар оршин суугчидтай харилцдаг вэ?</Label>
              <CheckGroup options={CHANNEL_OPTIONS} selected={channels} onToggle={(v) => toggle(channels, setChannels, v)} />
            </div>

            <div>
              <Label>Хамгийн их тулгамддаг асуудлууд?</Label>
              <CheckGroup options={PROBLEM_OPTIONS} selected={problems} onToggle={(v) => toggle(problems, setProblems, v)} />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label>Facebook групптэй юу?</Label>
                <Radio name="fb" options={YESNO} value={hasFb} onChange={setHasFb} />
              </div>
              <div>
                <Label>Excel-ээр бүртгэл хөтөлдөг үү?</Label>
                <Radio name="excel" options={YESNO} value={hasExcel} onChange={setHasExcel} />
              </div>
            </div>

            <div>
              <Label>Түрээслэгч / эзэмшигчийн мэдээлэл тодорхойгүй байдал хэр түвэгтэй вэ?</Label>
              <Radio name="renter" options={RENTER_ISSUE_OPTIONS} value={renterIssue} onChange={setRenterIssue} />
            </div>

            <div>
              <Label>Нэмэлт тэмдэглэл</Label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className={selectCls}
                placeholder="Танай СӨХ-ийн онцлог, тулгамдсан зүйлс..." />
            </div>

            <div>
              <Label>Хотол системд юу нэмж байвал танд тустай вэ?</Label>
              <textarea value={suggestions} onChange={(e) => setSuggestions(e.target.value)} rows={2} className={selectCls}
                placeholder="Санал хүсэлт..." />
            </div>
          </div>

          {/* Зөвшөөрөл + илгээх */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
            <label className="flex items-start gap-3 text-sm text-gray-700 cursor-pointer select-none">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)}
                className="mt-0.5 w-5 h-5 rounded border-gray-300" />
              <span>
                Дээрх мэдээллийг Хотол танилцуулга, холбоо барих зорилгоор хадгалж, ашиглахыг зөвшөөрч байна.
                Нууцлалын талаар <Link href="/privacy" className="text-blue-600 hover:underline">энд</Link> уншина уу.
              </span>
            </label>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-xl">{error}</div>
            )}

            <button type="submit" disabled={submitting}
              className="w-full bg-blue-600 text-white py-3.5 rounded-xl font-semibold hover:bg-blue-700 transition disabled:opacity-50">
              {submitting ? 'Илгээж байна...' : 'Хүсэлт илгээх'}
            </button>
            <p className="text-xs text-gray-400 text-center">
              Эсвэл шууд залгаарай: <a href="tel:+97694019927" className="text-blue-600 hover:underline">9401-9927</a>
            </p>
          </div>
        </form>
      </section>
    </div>
  );
}

const selectCls =
  'w-full border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500';

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-sm font-medium text-gray-700 mb-2">{children}</label>;
}

function Input({
  label, value, onChange, required, type = 'text', placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void;
  required?: boolean; type?: string; placeholder?: string;
}) {
  return (
    <div>
      <Label>{label}{required && <span className="text-red-500"> *</span>}</Label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={selectCls}
      />
    </div>
  );
}

function CheckGroup({ options, selected, onToggle }: { options: string[]; selected: string[]; onToggle: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = selected.includes(o);
        return (
          <button key={o} type="button" onClick={() => onToggle(o)}
            className={`px-3 py-2 rounded-xl text-sm border transition ${
              on ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
            }`}>
            {on ? '✓ ' : ''}{o}
          </button>
        );
      })}
    </div>
  );
}

function Radio({ name, options, value, onChange }: { name: string; options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button key={o} type="button" onClick={() => onChange(value === o ? '' : o)}
          className={`px-4 py-2 rounded-xl text-sm border transition ${
            value === o ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
          }`}
          data-name={name}>
          {o}
        </button>
      ))}
    </div>
  );
}
