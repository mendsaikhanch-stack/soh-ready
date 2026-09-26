// Сервер талын имэйл илгээлт (SMTP — OTP-той ижил тохиргоо).
//
// SMTP_USER/SMTP_PASS тохируулаагүй бол console-д хэвлээд stub=true буцаана —
// хөгжүүлэлтийн орчинд алдаа өгөхгүй, харин бүртгэлд «илгээгээгүй» гэж үлдэнэ.

import nodemailer from 'nodemailer';

export const SUPERADMIN_EMAIL = process.env.SUPERADMIN_EMAIL || 'mendsaikhanch@gmail.com';

export interface EmailResult {
  ok: boolean;
  /** true = SMTP тохируулаагүй, зөвхөн console-д хэвлэсэн */
  stub?: boolean;
  error?: string;
}

export async function sendEmail(input: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<EmailResult> {
  const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
  const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
  const smtpUser = process.env.SMTP_USER || '';
  const smtpPass = process.env.SMTP_PASS || '';

  if (!smtpUser || !smtpPass) {
    console.log(`[EMAIL→${input.to}] ${input.subject}\n${input.text}`);
    return { ok: true, stub: true };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
    });
    await transporter.sendMail({
      from: `"Хотол Платформ" <${smtpUser}>`,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Имэйл алдаа' };
  }
}
