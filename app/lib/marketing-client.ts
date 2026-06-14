// Маркетинг модулийн client-side fetch туслахууд.
// Бүх хүсэлт /api/admin/marketing/* proxy руу (service_role) дамжина.

import type { FbGroup, Campaign, QueueItem, Lead } from '@/app/lib/marketing/constants';

async function api<T = unknown>(
  path: string,
  opts?: { method?: string; body?: unknown },
): Promise<{ data?: T; error?: string; [k: string]: unknown }> {
  try {
    const res = await fetch(`/api/admin/marketing/${path}`, {
      method: opts?.method || 'GET',
      headers: opts?.body ? { 'Content-Type': 'application/json' } : undefined,
      body: opts?.body ? JSON.stringify(opts.body) : undefined,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { error: json.error || 'Алдаа гарлаа' };
    return json;
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Сүлжээний алдаа' };
  }
}

// ── Groups ──
export const mkt = {
  groups: {
    list: () => api<FbGroup[]>('groups'),
    create: (body: Partial<FbGroup>) => api<FbGroup>('groups', { method: 'POST', body: { mode: 'single', ...body } }),
    bulk: (text: string, group_type?: string, priority?: string) =>
      api<FbGroup[]>('groups', { method: 'POST', body: { mode: 'bulk', text, group_type, priority } }),
    update: (id: number, patch: Partial<FbGroup>) => api<FbGroup>('groups', { method: 'PATCH', body: { id, ...patch } }),
    remove: (id: number) => api(`groups?id=${id}`, { method: 'DELETE' }),
  },
  campaigns: {
    list: () => api<Campaign[]>('campaigns'),
    create: (body: { title?: string; main_text: string; link_url?: string }) =>
      api<Campaign>('campaigns', { method: 'POST', body }),
    update: (id: number, patch: Partial<Campaign>) => api<Campaign>('campaigns', { method: 'PATCH', body: { id, ...patch } }),
    remove: (id: number) => api(`campaigns?id=${id}`, { method: 'DELETE' }),
  },
  queue: {
    today: (date?: string) => api<QueueItem[]>(`queue${date ? `?date=${date}` : ''}`),
    generate: (campaign_id: number, opts?: { limit?: number; enhance?: boolean }) =>
      api<QueueItem[]>('queue', { method: 'POST', body: { action: 'generate', campaign_id, ...opts } }),
    setStatus: (id: number, action: 'mark_posted' | 'pending' | 'rejected' | 'requeue') =>
      api('queue', { method: 'POST', body: { action, id } }),
  },
  leads: {
    list: () => api<Lead[]>('leads'),
    create: (body: Partial<Lead>) => api<Lead>('leads', { method: 'POST', body }),
    update: (id: number, patch: Partial<Lead>) => api<Lead>('leads', { method: 'PATCH', body: { id, ...patch } }),
    remove: (id: number) => api(`leads?id=${id}`, { method: 'DELETE' }),
  },
  ai: {
    followUp: (lead_id: number) =>
      api<{ message: string; layer: string }>('ai', { method: 'POST', body: { action: 'follow_up', lead_id } }),
  },
  dashboard: () => api('dashboard'),
};
