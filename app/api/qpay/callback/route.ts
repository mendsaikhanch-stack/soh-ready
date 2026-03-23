import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase-admin';

// QPay callback — төлбөр төлөгдсөн үед QPay дуудна
export async function GET(request: NextRequest) {
  const orderId = request.nextUrl.searchParams.get('order_id');

  // Төлбөрийн бичлэг хадгалах (хэрэв order_id байвал)
  if (orderId) {
    await supabaseAdmin.from('payments').insert([{
      amount: 0, // Бодит дүнг payment check-с авна
      description: `QPay төлбөр #${orderId}`,
    }]);
  }

  return NextResponse.json({ success: true });
}

export async function POST(request: NextRequest) {
  // QPay POST callback-г бас хүлээн авна
  return GET(request);
}
