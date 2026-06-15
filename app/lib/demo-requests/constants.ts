// СӨХ Demo хүсэлт / Lead CRM модулийн нийтлэг тогтмолууд.
// Олон нийтийн форм (/demo), superadmin хуудас, API хоёул ашиглана.

export type DemoStatus =
  | 'new'
  | 'contacted'
  | 'demo_scheduled'
  | 'demo_done'
  | 'proposal_sent'
  | 'negotiating'
  | 'won'
  | 'lost'
  | 'later';

export type DemoPriority = 'low' | 'normal' | 'high' | 'urgent';

export type ContactMethod = 'phone' | 'messenger' | 'email' | 'meeting' | 'demo' | 'other';

export interface DemoRequest {
  id: string;
  created_at: string;
  updated_at: string;
  soh_name: string;
  city: string;
  district: string;
  khoroo: string | null;
  contact_name: string;
  phone: string;
  role: string | null;
  household_count: number | null;
  current_channels: string[];
  main_problems: string[];
  has_facebook_group: string | null;
  has_excel: string | null;
  renter_issue_level: string | null;
  notes: string | null;
  improvement_suggestions: string | null;
  consent: boolean;
  source_page: string | null;
  referrer: string | null;
  user_agent: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  status: DemoStatus;
  priority: DemoPriority | null;
  assigned_to: string | null;
  last_contacted_at: string | null;
  next_follow_up_at: string | null;
  internal_notes: string | null;
  price_note: string | null;
  lost_reason: string | null;
}

export interface DemoRequestNote {
  id: string;
  request_id: string;
  created_at: string;
  note: string;
  contact_method: ContactMethod | null;
  created_by: string | null;
}

// ── Олон нийтийн формын сонголтууд ──

export const ROLE_OPTIONS = [
  'СӨХ дарга',
  'Нягтлан',
  'СӨХ ажилтан',
  'Удирдах зөвлөлийн гишүүн',
  'Оршин суугч',
  'Бусад',
];

export const CHANNEL_OPTIONS = [
  'Мэдээллийн самбар',
  'Facebook group',
  'Messenger chat',
  'Утасны дуудлага',
  'Excel бүртгэл',
  'Аман яриа',
  'Бусад',
];

export const PROBLEM_OPTIONS = [
  'Төлбөрийн бүртгэл',
  'Зар мэдээлэл',
  'Хүсэлт гомдол',
  'Оршин суугчийн бүртгэл',
  'Түрээслэгч / эзэмшигчийн мэдээлэл',
  'Тайлан ил тод байдал',
  'Зөрчил / эвдрэл гэмтэл',
  'Зогсоол',
  'Бусад',
];

export const RENTER_ISSUE_OPTIONS = ['Бага', 'Дунд', 'Их', 'Мэдэхгүй'];

// ── CRM meta ──

export const DEMO_STATUSES: { value: DemoStatus; label: string; cls: string }[] = [
  { value: 'new', label: 'Шинэ', cls: 'bg-blue-100 text-blue-700' },
  { value: 'contacted', label: 'Холбогдсон', cls: 'bg-cyan-100 text-cyan-700' },
  { value: 'demo_scheduled', label: 'Demo товлосон', cls: 'bg-indigo-100 text-indigo-700' },
  { value: 'demo_done', label: 'Demo хийсэн', cls: 'bg-violet-100 text-violet-700' },
  { value: 'proposal_sent', label: 'Үнийн санал явуулсан', cls: 'bg-amber-100 text-amber-700' },
  { value: 'negotiating', label: 'Тохиролцож буй', cls: 'bg-orange-100 text-orange-700' },
  { value: 'won', label: 'Гэрээ болсон', cls: 'bg-green-100 text-green-700' },
  { value: 'lost', label: 'Алдсан', cls: 'bg-red-100 text-red-700' },
  { value: 'later', label: 'Дараа холбогдох', cls: 'bg-gray-100 text-gray-600' },
];

export const DEMO_PRIORITIES: { value: DemoPriority; label: string; cls: string }[] = [
  { value: 'low', label: 'Бага', cls: 'bg-gray-100 text-gray-600' },
  { value: 'normal', label: 'Энгийн', cls: 'bg-blue-100 text-blue-700' },
  { value: 'high', label: 'Өндөр', cls: 'bg-amber-100 text-amber-700' },
  { value: 'urgent', label: 'Яаралтай', cls: 'bg-red-100 text-red-700' },
];

export const CONTACT_METHODS: { value: ContactMethod; label: string; icon: string }[] = [
  { value: 'phone', label: 'Утас', icon: '📞' },
  { value: 'messenger', label: 'Messenger', icon: '💬' },
  { value: 'email', label: 'Имэйл', icon: '✉️' },
  { value: 'meeting', label: 'Уулзалт', icon: '🤝' },
  { value: 'demo', label: 'Demo', icon: '🖥' },
  { value: 'other', label: 'Бусад', icon: '•' },
];

// household_count хүрээ filter
export const HOUSEHOLD_RANGES: { value: string; label: string; min?: number; max?: number }[] = [
  { value: 'lt100', label: '100-аас доош', max: 99 },
  { value: '100_300', label: '100–300', min: 100, max: 300 },
  { value: '300_1000', label: '300–1000', min: 300, max: 1000 },
  { value: 'gt1000', label: '1000+', min: 1000 },
];

export function demoStatusMeta(s: string) {
  return DEMO_STATUSES.find((x) => x.value === s) || DEMO_STATUSES[0];
}
export function demoPriorityMeta(p: string | null) {
  return DEMO_PRIORITIES.find((x) => x.value === p) || DEMO_PRIORITIES[1];
}
export function contactMethodMeta(m: string | null) {
  return CONTACT_METHODS.find((x) => x.value === m) || CONTACT_METHODS[5];
}

export const VALID_STATUSES = new Set(DEMO_STATUSES.map((s) => s.value));
export const VALID_PRIORITIES = new Set(DEMO_PRIORITIES.map((p) => p.value));
export const VALID_CONTACT_METHODS = new Set(CONTACT_METHODS.map((m) => m.value));
