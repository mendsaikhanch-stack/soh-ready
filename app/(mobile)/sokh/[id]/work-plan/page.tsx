'use client';

import { useParams, useRouter } from 'next/navigation';
import WorkPlanList from '@/app/components/work-plan/WorkPlanList';

// «📅 Ажлын төлөвлөгөө» — оршин суугч СӨХ-ийн батлагдсан жилийн төлөвлөгөө,
// гүйцэтгэл, ТУЗ-ийн дүгнэлтийг харна.

export default function WorkPlanPage() {
  const params = useParams();
  const router = useRouter();
  const sokhId = Number(params.id);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-emerald-700 text-white px-4 pt-4 pb-3 sticky top-0 z-10">
        <button onClick={() => router.push(`/sokh/${params.id}`)} className="text-white/80 text-sm mb-1">← Буцах</button>
        <h1 className="text-lg font-bold">📅 Ажлын төлөвлөгөө</h1>
        <p className="text-xs text-white/70 mt-0.5">СӨХ-ийн жилийн төлөвлөгөө, гүйцэтгэл, ТУЗ-ийн дүгнэлт</p>
      </div>
      <div className="p-4">
        <WorkPlanList sokhId={sokhId} />
      </div>
    </div>
  );
}
