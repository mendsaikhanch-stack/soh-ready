// Хурлын модулийн нийтлэг төрөл, шошго — клиент болон серверт хоёуланд нь.
// Төлөвлөгөө: docs/meeting-management-plan.md

export type MeetingStatus = 'draft' | 'noticed' | 'in_progress' | 'closed' | 'archived' | 'cancelled';
export type MeetingKind = 'regular' | 'extraordinary';
export type VoteWeightMode = 'per_unit' | 'per_area';

export const MEETING_STATUS_LABEL: Record<MeetingStatus, string> = {
  draft: 'Ноорог',
  noticed: 'Зарлагдсан',
  in_progress: 'Хуралдаж байна',
  closed: 'Хаагдсан',
  archived: 'Архивласан',
  cancelled: 'Цуцлагдсан',
};

export const MEETING_KIND_LABEL: Record<MeetingKind, string> = {
  regular: 'Ээлжит',
  extraordinary: 'Ээлжит бус',
};

export const VOTE_WEIGHT_LABEL: Record<VoteWeightMode, string> = {
  per_unit: 'Нэг сууц — нэг санал',
  per_area: 'Сууцны талбайгаар (м²)',
};

export interface AgendaItemInput {
  title: string;
  description?: string | null;
  decision_draft?: string | null;
  pass_threshold_pct: number | null;
  pass_threshold_strict: boolean;
  prevote_enabled: boolean;
}

export interface MeetingInput {
  kind: MeetingKind;
  title: string;
  description: string | null;
  scheduled_at: string;
  location: string | null;
  online_url: string | null;
  convened_by_name: string | null;
  convened_basis: string | null;
  vote_weight_mode: VoteWeightMode | null;
  quorum_required_pct: number | null;
  quorum_strict: boolean;
  min_notice_days: number | null;
  prevote_counts_as_attendance: boolean | null;
}

// «50%-иас дээш» / «67%-иас багагүй» гэх мэт энгийн бичвэр
export function thresholdText(pct: number | null | undefined, strict: boolean): string {
  if (pct == null) return '—';
  return `${Number(pct)}%-${strict ? 'иас дээш' : 'иас багагүй'}`;
}
