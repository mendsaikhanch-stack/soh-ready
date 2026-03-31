import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

const SUPERADMIN_EMAIL = process.env.SUPERADMIN_EMAIL || 'mendsaikhanch@gmail.com';
const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 минут

// OTP санах ой дээр хадгалах
const otpStore = new Map<string, { code: string; expiresAt: number }>();

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendOTP(code: string): Promise<boolean> {
  const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
  const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
  const smtpUser = process.env.SMTP_USER || '';
  const smtpPass = process.env.SMTP_PASS || '';

  if (!smtpUser || !smtpPass) {
    console.log(`[OTP] Email тохиргоо хийгдээгүй. Код: ${code}`);
    return true; // Dev горимд console-д хэвлэнэ
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: { user: smtpUser, pass: smtpPass },
  });

  await transporter.sendMail({
    from: `"Тоот Платформ" <${smtpUser}>`,
    to: SUPERADMIN_EMAIL,
    subject: 'Тоот — Нэвтрэх код',
    text: `Таны нэвтрэх код: ${code}\n\nХүчинтэй хугацаа: 5 минут`,
    html: `
      <div style="font-family:sans-serif;max-width:400px;margin:0 auto;padding:20px">
        <h2 style="color:#2563eb">Тоот Платформ</h2>
        <p>Таны нэвтрэх код:</p>
        <div style="font-size:32px;font-weight:bold;letter-spacing:8px;text-align:center;background:#f3f4f6;padding:20px;border-radius:12px;margin:16px 0">${code}</div>
        <p style="color:#6b7280;font-size:14px">Хүчинтэй хугацаа: 5 минут</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0">
        <p style="color:#9ca3af;font-size:12px">Хэрэв та нэвтрэх оролдлого хийгээгүй бол энэ мэйлийг үл тоомсорлоно уу.</p>
      </div>
    `,
  });

  return true;
}

// OTP илгээх
export async function POST(req: NextRequest) {
  const body = await req.json();

  // OTP илгээх
  if (body.action === 'send') {
    const code = generateOTP();
    const key = 'superadmin';

    otpStore.set(key, { code, expiresAt: Date.now() + OTP_EXPIRY_MS });

    try {
      await sendOTP(code);
      return NextResponse.json({ sent: true, email: SUPERADMIN_EMAIL.replace(/(.{2}).*(@.*)/, '$1***$2') });
    } catch (err) {
      console.error('OTP send error:', err);
      return NextResponse.json({ error: 'Код илгээхэд алдаа гарлаа' }, { status: 500 });
    }
  }

  // OTP шалгах
  if (body.action === 'verify') {
    const { code } = body;
    const key = 'superadmin';
    const stored = otpStore.get(key);

    if (!stored) {
      return NextResponse.json({ error: 'Код илгээгдээгүй байна' }, { status: 400 });
    }

    if (Date.now() > stored.expiresAt) {
      otpStore.delete(key);
      return NextResponse.json({ error: 'Кодын хугацаа дууссан. Дахин илгээнэ үү' }, { status: 400 });
    }

    if (stored.code !== code) {
      return NextResponse.json({ error: 'Код буруу байна' }, { status: 400 });
    }

    // Амжилттай — OTP устгах
    otpStore.delete(key);

    // OTP баталгаажсан cookie тавих (12 цаг)
    const response = NextResponse.json({ verified: true });
    response.cookies.set('sa-otp-verified', 'true', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 43200,
      path: '/',
    });

    return response;
  }

  return NextResponse.json({ error: 'action шаардлагатай' }, { status: 400 });
}
