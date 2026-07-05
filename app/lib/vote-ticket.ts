import { createHmac } from 'crypto';

// OTP амжилттай баталгаажсаны дараа санал өгөх эрхийг богино хугацаагаар
// баталгаажуулах HMAC-signed ticket. session-token.ts-тэй ижил SECRET.

const SECRET = process.env.SESSION_SECRET || 'dev-secret-change-in-production';
const TICKET_MAX_AGE_MS = 15 * 60 * 1000; // 15 минут

function sign(payload: string): string {
  return createHmac('sha256', SECRET).update(payload).digest('hex').slice(0, 32);
}

// Санал өгөх ticket үүсгэх: proposalId:phone:ts.signature
export function createVoteTicket(proposalId: number, phone: string): string {
  const payload = `${proposalId}:${phone}:${Date.now()}`;
  return `${payload}.${sign(payload)}`;
}

// Ticket шалгах — proposalId тохирч, гарын үсэг зөв, хугацаа хүчинтэй эсэх
export function validateVoteTicket(
  token: string | undefined,
  proposalId: number,
): { valid: boolean; phone?: string } {
  if (!token) return { valid: false };

  const dotIdx = token.lastIndexOf('.');
  if (dotIdx === -1) return { valid: false };

  const payload = token.slice(0, dotIdx);
  const sig = token.slice(dotIdx + 1);
  if (sign(payload) !== sig) return { valid: false };

  const parts = payload.split(':');
  if (parts.length < 3) return { valid: false };

  const pid = parseInt(parts[0], 10);
  const phone = parts[1];
  const ts = parseInt(parts[2], 10);
  if (pid !== proposalId) return { valid: false };
  if (isNaN(ts) || Date.now() - ts > TICKET_MAX_AGE_MS) return { valid: false };

  return { valid: true, phone };
}

// Cookie нэр — proposal тус бүрд тусдаа
export function ticketCookieName(proposalId: number): string {
  return `vote-ticket-${proposalId}`;
}

// Монгол утас — цэвэрлэж сүүлийн 8 оронг авна
export function normalizePhone(raw: string): string {
  return (raw || '').replace(/\D/g, '').slice(-8);
}

// Нууцлалын үүднээс утсыг далдлах: 8812**** маягаар
export function maskPhone(phone: string): string {
  if (!phone || phone.length < 4) return '****';
  return `${phone.slice(0, 4)}****`;
}
