'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/app/lib/supabase';
import { useAuth } from '@/app/lib/auth-context';

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
  const { profile } = useAuth();
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [myVotes, setMyVotes] = useState<Record<number, string>>({});
  const [voting, setVoting] = useState<number | null>(null);

  const fetchPolls = async () => {
    const { data } = await supabase
      .from('polls')
      .select('*')
      .eq('sokh_id', params.id)
      .order('created_at', { ascending: false });

    setPolls(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchPolls();

    // Миний саналууд localStorage-с
    const saved = localStorage.getItem(`votes_${params.id}`);
    if (saved) setMyVotes(JSON.parse(saved));

    // Real-time subscription
    const channel = supabase
      .channel(`polls_${params.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'polls',
        filter: `sokh_id=eq.${params.id}`,
      }, (payload) => {
        setPolls(prev => prev.map(p => p.id === payload.new.id ? { ...p, ...payload.new } as Poll : p));
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'polls',
        filter: `sokh_id=eq.${params.id}`,
      }, (payload) => {
        setPolls(prev => [payload.new as Poll, ...prev]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [params.id]);

  const vote = async (pollId: number, choice: 'yes' | 'no') => {
    if (myVotes[pollId] || voting) return;
    setVoting(pollId);

    const field = choice === 'yes' ? 'yes_count' : 'no_count';
    const poll = polls.find(p => p.id === pollId);
    if (!poll) return;

    const { error } = await supabase
      .from('polls')
      .update({ [field]: (poll[`${field}` as keyof Poll] as number) + 1 })
      .eq('id', pollId);

    if (!error) {
      const updated = { ...myVotes, [pollId]: choice };
      setMyVotes(updated);
      localStorage.setItem(`votes_${params.id}`, JSON.stringify(updated));

      // Optimistic update
      setPolls(prev => prev.map(p =>
        p.id === pollId ? { ...p, [field]: (p[field as keyof Poll] as number) + 1 } : p
      ));
    }

    setVoting(null);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-pink-600 text-white px-4 py-4">
        <button onClick={() => router.push(`/sokh/${params.id}`)} className="text-white/80 text-sm mb-1">
          ← Буцах
        </button>
        <h1 className="text-lg font-bold">🗳 Санал хураалт</h1>
        <p className="text-xs text-white/60 mt-0.5">Үр дүн шууд шинэчлэгдэнэ</p>
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
              const noPercent = totalVotes > 0 ? 100 - yesPercent : 0;
              const isActive = p.status === 'active';
              const myVote = myVotes[p.id];

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
                      <span className="text-green-600 font-medium">👍 Тийм {p.yes_count} ({yesPercent}%)</span>
                      <span className="text-red-500 font-medium">👎 Үгүй {p.no_count} ({noPercent}%)</span>
                    </div>
                    <div className="w-full bg-red-200 rounded-full h-3 overflow-hidden">
                      <div
                        className="bg-green-500 h-3 rounded-full transition-all duration-500"
                        style={{ width: `${yesPercent}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      {totalVotes}/{p.total_voters} хүн саналаа өгсөн
                    </p>
                  </div>

                  {/* Vote buttons */}
                  {isActive && !myVote && (
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => vote(p.id, 'yes')}
                        disabled={voting === p.id}
                        className="flex-1 py-2.5 rounded-lg bg-green-500 text-white text-sm font-medium hover:bg-green-600 active:scale-[0.98] transition disabled:opacity-50"
                      >
                        {voting === p.id ? '...' : '👍 Тийм'}
                      </button>
                      <button
                        onClick={() => vote(p.id, 'no')}
                        disabled={voting === p.id}
                        className="flex-1 py-2.5 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 active:scale-[0.98] transition disabled:opacity-50"
                      >
                        {voting === p.id ? '...' : '👎 Үгүй'}
                      </button>
                    </div>
                  )}

                  {/* Already voted */}
                  {myVote && (
                    <div className={`mt-3 text-center py-2 rounded-lg text-sm font-medium ${
                      myVote === 'yes'
                        ? 'bg-green-50 text-green-600 border border-green-200'
                        : 'bg-red-50 text-red-500 border border-red-200'
                    }`}>
                      {myVote === 'yes' ? '👍 Тийм гэж саналаа өгсөн' : '👎 Үгүй гэж саналаа өгсөн'}
                    </div>
                  )}

                  {p.ends_at && (
                    <p className="text-[11px] text-gray-400 mt-2 text-center">
                      Дуусах: {new Date(p.ends_at).toLocaleDateString('mn-MN')}
                    </p>
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
