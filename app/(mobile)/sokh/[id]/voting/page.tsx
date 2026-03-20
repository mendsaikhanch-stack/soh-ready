'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/app/lib/supabase';

interface Poll {
  id: number;
  title: string;
  description: string;
  status: string;
  yes_count: number;
  no_count: number;
  total_voters: number;
  ends_at: string;
  created_at: string;
}

export default function VotingPage() {
  const params = useParams();
  const router = useRouter();
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from('polls')
        .select('*')
        .eq('sokh_id', params.id)
        .order('created_at', { ascending: false });

      setPolls(data || []);
      setLoading(false);
    };
    fetch();
  }, [params.id]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-pink-600 text-white px-4 py-4">
        <button onClick={() => router.push(`/sokh/${params.id}`)} className="text-white/80 text-sm mb-1">
          ← Буцах
        </button>
        <h1 className="text-lg font-bold">🗳 Санал хураалт</h1>
      </div>

      <div className="px-4 py-4">
        {loading ? (
          <p className="text-gray-400 text-center py-8">Ачаалж байна...</p>
        ) : polls.length === 0 ? (
          <div className="bg-white rounded-xl p-6 text-center">
            <p className="text-3xl mb-2">🗳</p>
            <p className="text-gray-400">Идэвхтэй санал хураалт байхгүй</p>
          </div>
        ) : (
          <div className="space-y-3">
            {polls.map((p) => {
              const totalVotes = p.yes_count + p.no_count;
              const yesPercent = totalVotes > 0 ? Math.round((p.yes_count / totalVotes) * 100) : 0;
              const isActive = p.status === 'active';

              return (
                <div key={p.id} className="bg-white rounded-xl p-4 shadow-sm">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold text-sm flex-1">{p.title}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {isActive ? 'Идэвхтэй' : 'Дууссан'}
                    </span>
                  </div>
                  {p.description && (
                    <p className="text-xs text-gray-500 mb-3">{p.description}</p>
                  )}

                  {/* Voting bar */}
                  <div className="mb-2">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-green-600">Тийм {yesPercent}%</span>
                      <span className="text-red-500">Үгүй {100 - yesPercent}%</span>
                    </div>
                    <div className="w-full bg-red-200 rounded-full h-3">
                      <div className="bg-green-500 h-3 rounded-full" style={{ width: `${yesPercent}%` }} />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      {totalVotes}/{p.total_voters} хүн саналаа өгсөн
                    </p>
                  </div>

                  {isActive && (
                    <div className="flex gap-2 mt-3">
                      <button className="flex-1 py-2 rounded-lg bg-green-500 text-white text-sm font-medium">
                        👍 Тийм
                      </button>
                      <button className="flex-1 py-2 rounded-lg bg-red-500 text-white text-sm font-medium">
                        👎 Үгүй
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
