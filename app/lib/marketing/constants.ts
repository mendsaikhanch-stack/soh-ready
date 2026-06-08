// Маркетинг / Outreach модулийн нийтлэг тогтмолууд.
// Client болон server хоёул ашиглана.

export type GroupType = 'hoa_mgmt' | 'resident' | 'apartment' | 'general';
export type GroupPriority = 'A' | 'B' | 'C';
export type GroupStatus = 'active' | 'paused' | 'banned';
export type QueueStatus = 'queued' | 'posted' | 'pending_approval' | 'rejected' | 'lead';
export type LeadStatus = 'new' | 'contacted' | 'converted' | 'lost';

export interface FbGroup {
  id: number;
  name: string;
  url: string;
  group_type: GroupType;
  priority: GroupPriority;
  status: GroupStatus;
  member_count: number | null;
  last_posted_at: string | null;
  next_allowed_at: string | null;
  posts_count: number;
  leads_count: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Campaign {
  id: number;
  title: string;
  main_text: string;
  link_url: string | null;
  status: 'active' | 'archived';
  created_at: string;
  updated_at: string;
}

export interface QueueItem {
  id: number;
  campaign_id: number;
  group_id: number;
  queue_date: string;
  caption: string;
  status: QueueStatus;
  ai_enhanced: boolean;
  posted_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // join-оор ирэх боломжтой
  group?: FbGroup | null;
}

export interface Lead {
  id: number;
  group_id: number | null;
  campaign_id: number | null;
  queue_item_id: number | null;
  name: string | null;
  contact: string | null;
  note: string | null;
  status: LeadStatus;
  follow_up_message: string | null;
  created_at: string;
  updated_at: string;
  group?: FbGroup | null;
}

// Cooldown — нэг группэд дахин постлох хүртэлх хоног
export const COOLDOWN_DAYS = 7;

// Өдрийн дараалалд орох группийн тоо (10–15)
export const QUEUE_MIN = 10;
export const QUEUE_DEFAULT = 12;
export const QUEUE_MAX = 15;

export const GROUP_TYPES: { value: GroupType; label: string; icon: string }[] = [
  { value: 'hoa_mgmt', label: 'СӨХ удирдлага', icon: '🏛' },
  { value: 'resident', label: 'Оршин суугч', icon: '🏠' },
  { value: 'apartment', label: 'Байр / хороолол', icon: '🏢' },
  { value: 'general', label: 'Ерөнхий', icon: '🌐' },
];

export const PRIORITIES: { value: GroupPriority; label: string; cls: string }[] = [
  { value: 'A', label: 'A — Өндөр', cls: 'bg-red-100 text-red-700' },
  { value: 'B', label: 'B — Дунд', cls: 'bg-amber-100 text-amber-700' },
  { value: 'C', label: 'C — Бага', cls: 'bg-gray-100 text-gray-600' },
];

export const GROUP_STATUSES: { value: GroupStatus; label: string; cls: string }[] = [
  { value: 'active', label: 'Идэвхтэй', cls: 'bg-green-100 text-green-700' },
  { value: 'paused', label: 'Түр зогссон', cls: 'bg-gray-100 text-gray-500' },
  { value: 'banned', label: 'Хориглогдсон', cls: 'bg-red-100 text-red-700' },
];

export const QUEUE_STATUSES: { value: QueueStatus; label: string; cls: string }[] = [
  { value: 'queued', label: 'Хүлээгдэж буй', cls: 'bg-blue-100 text-blue-700' },
  { value: 'posted', label: 'Постолсон', cls: 'bg-green-100 text-green-700' },
  { value: 'pending_approval', label: 'Зөвшөөрөл хүлээж буй', cls: 'bg-amber-100 text-amber-700' },
  { value: 'rejected', label: 'Татгалзсан', cls: 'bg-red-100 text-red-700' },
  { value: 'lead', label: 'Лид ирсэн', cls: 'bg-purple-100 text-purple-700' },
];

export const LEAD_STATUSES: { value: LeadStatus; label: string; cls: string }[] = [
  { value: 'new', label: 'Шинэ', cls: 'bg-blue-100 text-blue-700' },
  { value: 'contacted', label: 'Холбогдсон', cls: 'bg-amber-100 text-amber-700' },
  { value: 'converted', label: 'Гэрээ хийсэн', cls: 'bg-green-100 text-green-700' },
  { value: 'lost', label: 'Алдсан', cls: 'bg-gray-100 text-gray-500' },
];

export function groupTypeMeta(t: string) {
  return GROUP_TYPES.find((x) => x.value === t) || GROUP_TYPES[3];
}
export function priorityMeta(p: string) {
  return PRIORITIES.find((x) => x.value === p) || PRIORITIES[1];
}
export function groupStatusMeta(s: string) {
  return GROUP_STATUSES.find((x) => x.value === s) || GROUP_STATUSES[0];
}
export function queueStatusMeta(s: string) {
  return QUEUE_STATUSES.find((x) => x.value === s) || QUEUE_STATUSES[0];
}
export function leadStatusMeta(s: string) {
  return LEAD_STATUSES.find((x) => x.value === s) || LEAD_STATUSES[0];
}
