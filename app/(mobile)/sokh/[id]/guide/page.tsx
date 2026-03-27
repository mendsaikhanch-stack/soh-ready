'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

interface GuideSection {
  icon: string;
  title: string;
  steps: string[];
}

const guides: GuideSection[] = [
  {
    icon: '💰',
    title: 'Төлбөр төлөх',
    steps: [
      'Нүүр хуудаснаас "Төлбөр" товчийг дарна',
      'Төлөгдөөгүй төлбөрүүд харагдана',
      '"Төлөх" товч дарж QPay эсвэл банкны апп сонгоно',
      'QR кодыг банкны апп-аар уншуулна',
      'Төлбөр баталгаажсаны дараа амжилттай гэж мэдэгдэнэ',
      '"Түүх" таб-с төлбөрийн баримт харж, хуулж болно',
    ],
  },
  {
    icon: '🔧',
    title: 'Засвар хүсэлт илгээх',
    steps: [
      '"Засвар" хуудас руу орно',
      '"+ Шинэ хүсэлт гаргах" товч дарна',
      'Гарчиг болон тайлбар бичнэ',
      'Зураг хавсаргах бол 📷 товч дарж камер/галерей-аас сонгоно',
      '"Илгээх" товч дарна',
      'Хүсэлтийн төлөв (хүлээгдэж буй → хийгдэж байна → дууссан) шалгаж болно',
    ],
  },
  {
    icon: '🗳',
    title: 'Санал хураалтад оролцох',
    steps: [
      '"Санал хураалт" хуудас руу орно',
      'Идэвхтэй санал хураалтуудыг харна',
      '"Тийм" эсвэл "Үгүй" товч дарж саналаа өгнө',
      'Үр дүн шууд (real-time) шинэчлэгдэнэ',
      'Нэг удаа саналаа өгсний дараа өөрчлөх боломжгүй',
    ],
  },
  {
    icon: '📢',
    title: 'Зарлал & Мэдэгдэл',
    steps: [
      'Нүүр хуудсанд сүүлийн зарлал харагдана',
      '"Зарлал" хуудаснаас бүх зарлал уншиж болно',
      'Push notification идэвхжүүлсэн бол шинэ зарлал утсанд мэдэгдэнэ',
      '🔔 хонх дээр дарж мэдэгдлүүдээ нэг дор харна',
    ],
  },
  {
    icon: '💬',
    title: 'Хөрш чат',
    steps: [
      '"Хөрш чат" хуудас руу орно',
      'Мессеж бичээд илгээх товч дарна',
      'Бусад оршин суугчидтай шууд ярилцаж болно',
      'Мессежүүд шууд (real-time) ирнэ',
    ],
  },
  {
    icon: '📊',
    title: 'Тоолуурын заалт оруулах',
    steps: [
      '"ОСНАА" эсвэл "Цахилгаан" таб-аас тоолуур сонгоно',
      'Тоолуурын заалтаа оруулна',
      'Хэрэглээ автоматаар тооцоологдоно',
      'Нэхэмжлэх таб-аас төлбөрийн дүнг харна',
    ],
  },
  {
    icon: '👤',
    title: 'Профайл засах',
    steps: [
      'Нүүр хуудасны дээд хэсэгт байгаа нэрийн дээрээ дарна',
      'Нэр, утасны дугаар засах боломжтой',
      '"Хадгалах" товч дарна',
      'Байр/тоот, имэйл солихыг СӨХ админд хандана уу',
    ],
  },
  {
    icon: '🌙',
    title: 'Тохиргоо',
    steps: [
      'Нүүр хуудаснаас 🌙/☀️ товчоор Dark mode идэвхжүүлнэ',
      'EN/MN товчоор хэл солино',
      '"Гарах" товч дарж системээс гарна',
    ],
  },
];

export default function GuidePage() {
  const params = useParams();
  const router = useRouter();
  const [expandedIdx, setExpandedIdx] = useState<number | null>(0);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-4">
        <button onClick={() => router.push(`/sokh/${params.id}`)} className="text-white/80 text-sm mb-1">
          ← Буцах
        </button>
        <h1 className="text-lg font-bold">📖 Гарын авлага</h1>
        <p className="text-xs text-white/60 mt-0.5">Апп хэрхэн ашиглах заавар</p>
      </div>

      <div className="px-4 py-4 space-y-2">
        {guides.map((g, i) => {
          const isOpen = expandedIdx === i;
          return (
            <div key={i} className="bg-white rounded-xl shadow-sm overflow-hidden">
              <button
                onClick={() => setExpandedIdx(isOpen ? null : i)}
                className="w-full flex items-center gap-3 p-4 text-left"
              >
                <span className="text-2xl">{g.icon}</span>
                <span className="flex-1 font-medium text-sm">{g.title}</span>
                <span className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}>
                  ▼
                </span>
              </button>
              {isOpen && (
                <div className="px-4 pb-4 pt-0">
                  <div className="border-t border-gray-100 pt-3 space-y-2.5">
                    {g.steps.map((step, j) => (
                      <div key={j} className="flex gap-3 items-start">
                        <span className="w-6 h-6 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                          {j + 1}
                        </span>
                        <p className="text-sm text-gray-600 pt-0.5">{step}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
