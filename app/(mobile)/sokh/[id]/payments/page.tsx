'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/app/lib/supabase';

interface Payment {
  id: number;
  amount: number;
  description: string;
  paid_at: string;
  resident_name?: string;
}

export default function PaymentsPage() {
  const params = useParams();
  const router = useRouter();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [monthlyFee] = useState(50000);
  const [myDebt] = useState(150000);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPayments = async () => {
      const { data } = await supabase
        .from('payments')
        .select('*')
        .order('paid_at', { ascending: false })
        .limit(20);

      setPayments(data || []);
      setLoading(false);
    };
    fetchPayments();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-green-600 text-white px-4 py-4">
        <button onClick={() => router.push(`/sokh/${params.id}`)} className="text-white/80 text-sm mb-1">
          ← Буцах
        </button>
        <h1 className="text-lg font-bold">💰 Төлбөр</h1>
      </div>

      {/* Balance Card */}
      <div className="px-4 -mt-3">
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex justify-between items-center mb-3">
            <div>
              <p className="text-xs text-gray-500">Сарын төлбөр</p>
              <p className="text-xl font-bold">{monthlyFee.toLocaleString()}₮</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Миний өр</p>
              <p className={`text-xl font-bold ${myDebt > 0 ? 'text-red-500' : 'text-green-500'}`}>
                {myDebt.toLocaleString()}₮
              </p>
            </div>
          </div>
          <button className="w-full bg-green-600 text-white py-3 rounded-xl font-medium active:bg-green-700 transition">
            Төлбөр төлөх
          </button>
        </div>
      </div>

      {/* Payment History */}
      <div className="px-4 py-4">
        <h2 className="text-sm font-semibold text-gray-500 mb-3">ТӨЛБӨРИЙН ТҮҮХ</h2>
        {loading ? (
          <p className="text-gray-400 text-center py-8">Ачаалж байна...</p>
        ) : payments.length === 0 ? (
          <div className="bg-white rounded-xl p-6 text-center">
            <p className="text-gray-400">Төлбөрийн түүх байхгүй</p>
          </div>
        ) : (
          <div className="space-y-2">
            {payments.map((p) => (
              <div key={p.id} className="bg-white rounded-xl p-3 flex justify-between items-center">
                <div>
                  <p className="font-medium text-sm">{p.description || 'Сарын төлбөр'}</p>
                  <p className="text-xs text-gray-400">
                    {new Date(p.paid_at).toLocaleDateString('mn-MN')}
                  </p>
                </div>
                <span className="text-green-600 font-semibold text-sm">
                  -{p.amount.toLocaleString()}₮
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
