'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/app/lib/supabase';
import { adminFrom } from '@/app/lib/admin-db';
import { getAdminSokhId } from '@/app/lib/admin-config';

interface ElevatorTask {
  id: number;
  elevator_name: string;
  task_type: string;
  description: string;
  scheduled_date: string;
  status: string;
  assigned_to: string;
  notes: string;
  created_at: string;
}

const taskTypes = [
  { value: 'inspection', label: 'Техникийн үзлэг', icon: '🔍' },
  { value: 'maintenance', label: 'Засвар үйлчилгээ', icon: '🔧' },
  { value: 'repair', label: 'Эвдрэл засвар', icon: '🛠' },
  { value: 'cleaning', label: 'Цэвэрлэгээ', icon: '🧹' },
  { value: 'certification', label: 'Гэрчилгээ шинэчлэх', icon: '📋' },
];

const statusMap: Record<string, { label: string; color: string }> = {
  scheduled: { label: 'Хуваарилсан', color: 'bg-blue-100 text-blue-700' },
  in_progress: { label: 'Хийгдэж байна', color: 'bg-yellow-100 text-yellow-700' },
  completed: { label: 'Дууссан', color: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Цуцлагдсан', color: 'bg-red-100 text-red-700' },
};

export default function ElevatorPage() {
  const [tasks, setTasks] = useState<ElevatorTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [elevatorName, setElevatorName] = useState('Лифт #1');
  const [taskType, setTaskType] = useState('inspection');
  const [description, setDescription] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [assignedTo, setAssignedTo] = useState('');

  useEffect(() => { fetchTasks(); }, []);

  const fetchTasks = async () => {
    const { data } = await supabase
      .from('elevator_tasks')
      .select('*')
      .order('scheduled_date', { ascending: true });
    setTasks(data || []);
    setLoading(false);
  };

  const createTask = async () => {
    if (!scheduledDate) return;
    setSaving(true);
    const sokhId = await getAdminSokhId();
    await adminFrom('elevator_tasks').insert([{
      sokh_id: sokhId,
      elevator_name: elevatorName,
      task_type: taskType,
      description,
      scheduled_date: scheduledDate,
      assigned_to: assignedTo,
      status: 'scheduled',
    }]);
    setShowForm(false);
    setDescription(''); setScheduledDate(''); setAssignedTo('');
    setSaving(false);
    await fetchTasks();
  };

  const updateStatus = async (id: number, status: string) => {
    await adminFrom('elevator_tasks').update({ status }).eq('id', id);
    await fetchTasks();
  };

  const deleteTask = async (id: number) => {
    if (!confirm('Устгах уу?')) return;
    await adminFrom('elevator_tasks').delete().eq('id', id);
    await fetchTasks();
  };

  const upcoming = tasks.filter(t => t.status === 'scheduled' || t.status === 'in_progress');
  const past = tasks.filter(t => t.status === 'completed' || t.status === 'cancelled');

  const isOverdue = (date: string) => new Date(date) < new Date() && !['completed', 'cancelled'].includes(tasks.find(t => t.scheduled_date === date)?.status || '');

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">🛗 Лифт засвар хуваарь</h1>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="rounded-xl border p-4 bg-blue-50 border-blue-200">
          <p className="text-xl font-bold text-blue-700">{upcoming.length}</p>
          <p className="text-xs text-gray-500">Товлосон</p>
        </div>
        <div className="rounded-xl border p-4 bg-green-50 border-green-200">
          <p className="text-xl font-bold text-green-700">{past.filter(t => t.status === 'completed').length}</p>
          <p className="text-xs text-gray-500">Дууссан</p>
        </div>
        <div className="rounded-xl border p-4 bg-amber-50 border-amber-200">
          <p className="text-xl font-bold text-amber-700">{tasks.length}</p>
          <p className="text-xs text-gray-500">Нийт</p>
        </div>
      </div>

      <button onClick={() => setShowForm(!showForm)}
        className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 mb-4">
        + Шинэ хуваарь нэмэх
      </button>

      {showForm && (
        <div className="bg-white border rounded-xl p-4 mb-4">
          <h3 className="font-semibold text-sm mb-3">Засварын хуваарь нэмэх</h3>
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="Лифтийн нэр" value={elevatorName}
              onChange={e => setElevatorName(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
            <select value={taskType} onChange={e => setTaskType(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm">
              {taskTypes.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
            </select>
            <input type="date" value={scheduledDate}
              onChange={e => setScheduledDate(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
            <input placeholder="Хариуцагч" value={assignedTo}
              onChange={e => setAssignedTo(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
            <textarea placeholder="Тайлбар..." value={description}
              onChange={e => setDescription(e.target.value)} rows={2}
              className="col-span-2 border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg border text-sm">Цуцлах</button>
            <button onClick={createTask} disabled={saving || !scheduledDate}
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm disabled:opacity-50">
              {saving ? '...' : 'Нэмэх'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-gray-400 text-center py-8">Ачаалж байна...</p>
      ) : (
        <>
          {upcoming.length > 0 && (
            <>
              <h2 className="text-sm font-semibold text-gray-500 mb-3">ТОВЛОСОН ЗАСВАР</h2>
              <div className="space-y-3 mb-6">
                {upcoming.map(t => {
                  const tt = taskTypes.find(x => x.value === t.task_type) || taskTypes[0];
                  const st = statusMap[t.status] || statusMap.scheduled;
                  const overdue = new Date(t.scheduled_date) < new Date() && t.status === 'scheduled';
                  return (
                    <div key={t.id} className={`bg-white border rounded-xl p-4 ${overdue ? 'border-red-300 bg-red-50' : ''}`}>
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{tt.icon}</span>
                          <div>
                            <h3 className="font-semibold text-sm">{t.elevator_name} — {tt.label}</h3>
                            <p className="text-xs text-gray-500">{new Date(t.scheduled_date).toLocaleDateString('mn-MN')}
                              {overdue && <span className="text-red-500 ml-1 font-medium">Хугацаа хэтэрсэн!</span>}
                            </p>
                          </div>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${st.color}`}>{st.label}</span>
                      </div>
                      {t.description && <p className="text-xs text-gray-500 mb-2">{t.description}</p>}
                      {t.assigned_to && <p className="text-xs text-gray-400 mb-2">Хариуцагч: {t.assigned_to}</p>}
                      <div className="flex gap-2">
                        {t.status === 'scheduled' && (
                          <button onClick={() => updateStatus(t.id, 'in_progress')}
                            className="text-xs px-3 py-1 bg-yellow-100 text-yellow-700 rounded-lg">Эхлэх</button>
                        )}
                        {(t.status === 'scheduled' || t.status === 'in_progress') && (
                          <button onClick={() => updateStatus(t.id, 'completed')}
                            className="text-xs px-3 py-1 bg-green-100 text-green-700 rounded-lg">Дуусгах</button>
                        )}
                        <button onClick={() => updateStatus(t.id, 'cancelled')}
                          className="text-xs px-3 py-1 bg-red-100 text-red-500 rounded-lg">Цуцлах</button>
                        <button onClick={() => deleteTask(t.id)}
                          className="text-xs px-3 py-1 text-gray-400 hover:text-red-500">Устгах</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {past.length > 0 && (
            <>
              <h2 className="text-sm font-semibold text-gray-500 mb-3">ТҮҮХ</h2>
              <div className="space-y-2">
                {past.map(t => {
                  const tt = taskTypes.find(x => x.value === t.task_type) || taskTypes[0];
                  const st = statusMap[t.status] || statusMap.completed;
                  return (
                    <div key={t.id} className="bg-white border rounded-xl p-3 opacity-75">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span>{tt.icon}</span>
                          <span className="text-sm">{t.elevator_name} — {tt.label}</span>
                          <span className="text-xs text-gray-400">{new Date(t.scheduled_date).toLocaleDateString('mn-MN')}</span>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${st.color}`}>{st.label}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {tasks.length === 0 && <p className="text-gray-400 text-center py-8">Засварын хуваарь байхгүй</p>}
        </>
      )}
    </div>
  );
}
