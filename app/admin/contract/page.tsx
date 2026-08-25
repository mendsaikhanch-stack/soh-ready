'use client';

// СӨХ-ийн дарга — Хотолтой байгуулах үйлчилгээний гэрээгээ харах, татах.
//
// Гэрээний агуулгыг сервер бэлдэж өгнө (`/api/admin/contract`). Энд текст
// бичихгүй — эс тэгвэл дэлгэц дээрх нөхцөл, татсан файл дахь нөхцөл хоёр
// зөрөх эрсдэлтэй. Хуудас нь зөвхөн харуулах, хэвлэх, татах үүрэгтэй.

import { useState, useEffect, useRef } from 'react';

interface ContractData {
  unlocked: boolean;
  migrated: boolean;
  number?: string;
  unlocked_at?: string;
  downloaded_at?: string | null;
  org: { name: string; address?: string | null; phone?: string | null; email?: string | null };
  apartments?: number;
  setup_fee?: number;
  monthly_fee?: number;
  free_months?: number;
  billing_starts_at?: string | null;
  section_titles?: string[];
  html?: string;
}

const money = (n?: number) => (typeof n === 'number' ? `${n.toLocaleString('en-US')}₮` : '—');

const mnDate = (s?: string | null) =>
  s ? new Date(s).toLocaleDateString('mn-MN', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '—';

const todayISO = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export default function AdminContractPage() {
  const [data, setData] = useState<ContractData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // Гэрээн дээр гараар бөглөх талбарууд. DB-д хадгалахгүй — зөвхөн энэ
  // удаагийн баримтад буулгана.
  const [chairman, setChairman] = useState('');
  const [register, setRegister] = useState('');
  const [date, setDate] = useState(todayISO());

  const frameRef = useRef<HTMLIFrameElement>(null);

  const params = () => {
    const q = new URLSearchParams();
    if (chairman.trim()) q.set('chairman', chairman.trim());
    if (register.trim()) q.set('register', register.trim());
    if (date) q.set('date', date);
    return q;
  };

  const load = async (silent = false) => {
    if (silent) setRefreshing(true);
    try {
      const q = params();
      const res = await fetch(`/api/admin/contract?${q.toString()}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Гэрээг ачаалж чадсангүй');
      } else {
        setError('');
        setData(json);
      }
    } catch {
      setError('Сүлжээний алдаа');
    }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    const init = async () => { await load(); };
    init();
    // Анх ачаалахад л дуудна — талбар өөрчлөгдөхөд «Гэрээнд буулгах» товчоор шинэчилнэ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const printContract = () => {
    const w = frameRef.current?.contentWindow;
    if (!w) return;
    w.focus();
    w.print();
  };

  if (loading) return <div className="p-6 text-gray-400">Ачаалж байна...</div>;

  if (error && !data) {
    return <div className="p-6 text-red-600">{error}</div>;
  }

  // Эрх нээгдээгүй — гэрээ бэлэн болоогүй
  if (!data?.unlocked) {
    return (
      <div className="p-6 max-w-2xl">
        <h1 className="text-2xl font-bold mb-1">📄 Үйлчилгээний гэрээ</h1>
        <p className="text-sm text-gray-500 mb-6">
          Хотолтой байгуулах гэрээгээ эндээс татаж авна.
        </p>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
          <p className="font-semibold text-amber-900 mb-1">Гэрээ хараахан бэлэн болоогүй байна</p>
          <p className="text-sm text-amber-800 leading-relaxed">
            Хотолын зүгээс таны СӨХ-д гэрээ нээгдсэний дараа энэ хуудсанд гарч ирнэ.
            Нөхцөл, төлбөрөө ярилцахыг хүсвэл бидэнтэй холбогдоно уу:
          </p>
          <p className="text-sm mt-3 text-amber-900">
            📞 <a href="tel:+97694019927" className="underline">9401-9927</a>
            {' · '}
            ✉️ <a href="mailto:tugsorchin@yahoo.com" className="underline">tugsorchin@yahoo.com</a>
          </p>
        </div>
        <p className="text-xs text-gray-500 mt-4">
          Гэрээ байгуулахаас өмнө{' '}
          <a href="/terms/admin" className="text-blue-600 hover:underline">Үйлчилгээний нөхцөл</a>{' '}
          болон{' '}
          <a href="/privacy" className="text-blue-600 hover:underline">Нууцлалын бодлого</a>-той
          танилцаж болно.
        </p>
      </div>
    );
  }

  const docUrl = `/api/admin/contract?format=doc&${params().toString()}`;

  return (
    <div className="p-6 max-w-5xl">
      <h1 className="text-2xl font-bold mb-1">📄 Үйлчилгээний гэрээ</h1>
      <p className="text-sm text-gray-500 mb-6">
        Дугаар <b>{data.number}</b> · таны СӨХ-ийн айлын тоогоор дүн нь бодогдсон.
        Хэвлээд гарын үсэг, тамга дараад нэг хувийг Хотол руу илгээнэ.
      </p>

      {/* Гэрээний гол тоо */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Айлын тоо', value: String(data.apartments ?? 0) },
          { label: 'Суурилуулалт (нэг удаа)', value: money(data.setup_fee) },
          { label: 'Сарын хураамж', value: money(data.monthly_fee) },
          { label: 'Үнэгүй хугацаа', value: `${data.free_months ?? 0} сар` },
        ].map(x => (
          <div key={x.label} className="bg-white border rounded-xl p-4">
            <p className="text-[11px] uppercase tracking-wide text-gray-400 mb-1">{x.label}</p>
            <p className="text-lg font-bold">{x.value}</p>
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-500 -mt-3 mb-5">
        Сарын хураамж <b>{mnDate(data.billing_starts_at)}</b>-ний өдрөөс эхэлж тооцогдоно.
        Айлын тоо өөрчлөгдвөл дараагийн сараас шинэ тоогоор бодогдоно.
      </p>

      {/* Гараар бөглөх талбарууд */}
      <div className="bg-white border rounded-xl p-5 mb-5">
        <p className="text-sm font-semibold mb-3">Гэрээнд буулгах мэдээлэл</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">СӨХ-ийн даргын овог нэр</label>
            <input
              value={chairman}
              onChange={e => setChairman(e.target.value)}
              placeholder="Ж: Б.Батбаяр"
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Улсын бүртгэлийн дугаар</label>
            <input
              value={register}
              onChange={e => setRegister(e.target.value)}
              placeholder="Ж: 9012345"
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Гэрээ байгуулах огноо</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-4">
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="text-sm px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-50"
          >
            {refreshing ? 'Шинэчилж байна...' : 'Гэрээнд буулгах'}
          </button>
          <button
            onClick={printContract}
            className="text-sm px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
          >
            🖨 Хэвлэх / PDF болгох
          </button>
          <a
            href={docUrl}
            className="text-sm px-4 py-2 rounded-lg border hover:bg-gray-50"
          >
            ⬇ Word-оор татах
          </a>
          <span className="text-xs text-gray-400">
            Хоосон үлдээсэн талбар гэрээн дээр цэгтэй мөр болж, гараар бөглөх боломжтой.
            Хотолын тамга, гарын үсэг PDF хувилбарт суусан байна — Word-т гарахгүй.
          </span>
        </div>
      </div>

      {/* Урьдчилан харах */}
      <div className="bg-white border rounded-xl overflow-hidden">
        <iframe
          ref={frameRef}
          title="Үйлчилгээний гэрээ"
          srcDoc={data.html}
          className="w-full"
          style={{ height: '80vh', border: 0 }}
        />
      </div>

      <p className="text-xs text-gray-500 mt-3">
        Гэрээ нээгдсэн: {mnDate(data.unlocked_at)}
        {data.downloaded_at ? ` · сүүлд татсан: ${mnDate(data.downloaded_at)}` : ''}
      </p>
    </div>
  );
}
