import { MEETING_STATUS_LABEL, type MeetingStatus } from '@/app/lib/meetings/labels';

export default function MeetingStatusBadge({ status }: { status: MeetingStatus }) {
  const cls =
    status === 'draft' ? 'bg-gray-100 text-gray-600'
    : status === 'noticed' ? 'bg-blue-100 text-blue-700'
    : status === 'in_progress' ? 'bg-amber-100 text-amber-700'
    : status === 'cancelled' ? 'bg-red-100 text-red-700'
    : 'bg-green-100 text-green-700';
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded whitespace-nowrap ${cls}`}>{MEETING_STATUS_LABEL[status] || status}</span>;
}
