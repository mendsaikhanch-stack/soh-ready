import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { checkPayment } from '@/app/lib/qpay';
import { createReceipt, isEbarimtConfigured } from '@/app/lib/ebarimt';
import type { EbarimtEntityType } from '@/app/lib/ebarimt';

// QPay callback — төлбөр төлөгдсөн үед QPay дуудна
export async function GET(request: NextRequest) {
  const orderId = request.nextUrl.searchParams.get('order_id');

  if (!orderId || !/^[a-zA-Z0-9\-_]+$/.test(orderId)) {
    return NextResponse.json({ error: 'Valid order_id required' }, { status: 400 });
  }

  // Давхар callback шалгах — аль хэдийн бичигдсэн бол дахин бичихгүй
  const { data: existing } = await supabaseAdmin
    .from('payments')
    .select('id')
    .eq('description', `QPay төлбөр #${orderId}`)
    .limit(1);

  if (existing && existing.length > 0) {
    return NextResponse.json({ success: true, duplicate: true });
  }

  // QPay API-аар төлбөр баталгаажуулах
  try {
    const result = await checkPayment(orderId);
    const paid = result.count > 0 && result.rows?.some(
      (r: { payment_status: string }) => r.payment_status === 'PAID'
    );

    if (!paid) {
      return NextResponse.json({ error: 'Payment not verified' }, { status: 400 });
    }

    const paidAmount = result.paid_amount || 0;

    // Баталгаажсан төлбөрийг хадгалах
    await supabaseAdmin.from('payments').insert([{
      amount: paidAmount,
      description: `QPay төлбөр #${orderId}`,
    }]);

    // Комисс бүртгэх: orderId-аас sokh_id олох (TOOT-{sokhId}-{ts} формат)
    const sokhMatch = orderId.match(/^TOOT-(\d+)-/);
    if (sokhMatch) {
      const sokhId = parseInt(sokhMatch[1], 10);
      // Идэвхтэй захиалгын комисс хувийг авах
      const { data: sub } = await supabaseAdmin
        .from('sokh_subscriptions')
        .select('id, custom_pricing, platform_plans(commission_percent)')
        .eq('sokh_id', sokhId)
        .in('status', ['active', 'trial'])
        .limit(1)
        .single();

      if (sub) {
        const plan = sub.platform_plans as unknown as { commission_percent: number } | null;
        const custom = (sub.custom_pricing || {}) as Record<string, number>;
        const rate = custom.commission_percent ?? plan?.commission_percent ?? 0;
        if (rate > 0) {
          const commissionAmount = Math.round((paidAmount * rate) / 100);
          await supabaseAdmin.from('platform_transactions').insert({
            sokh_id: sokhId,
            total_amount: paidAmount,
            commission_rate: rate,
            commission_amount: commissionAmount,
            qpay_order_id: orderId,
            status: 'confirmed',
          });
        }
      }
    }

    // eBarimt баримт автомат үүсгэх
    // orderId формат: TOOT-{sokhId}-{ts} эсвэл OSNAA-{id}-{ts} эсвэл TSAH-{id}-{ts}
    let ebarimtResult = null;
    let ebarimtEntityType: EbarimtEntityType = 'sokh';
    let ebarimtEntityId: number | undefined;

    if (sokhMatch) {
      ebarimtEntityType = 'sokh';
      ebarimtEntityId = parseInt(sokhMatch[1], 10);
    }
    const osnaaMatch = orderId.match(/^OSNAA-(\d+)-/);
    if (osnaaMatch) {
      ebarimtEntityType = 'osnaa';
      ebarimtEntityId = parseInt(osnaaMatch[1], 10);
    }
    const tsahMatch = orderId.match(/^TSAH-(\d+)-/);
    if (tsahMatch) {
      ebarimtEntityType = 'tsah';
      ebarimtEntityId = parseInt(tsahMatch[1], 10);
    }

    if (paidAmount > 0 && await isEbarimtConfigured(ebarimtEntityType, ebarimtEntityId)) {
      try {
        const labelMap: Record<EbarimtEntityType, string> = {
          sokh: 'СӨХ хураамж', osnaa: 'ОСНАА төлбөр', tsah: 'Цахилгааны төлбөр', platform: 'Платформ төлбөр',
        };
        ebarimtResult = await createReceipt({
          entityType: ebarimtEntityType,
          entityId: ebarimtEntityId,
          amount: paidAmount,
          description: `${labelMap[ebarimtEntityType]} #${orderId}`,
          items: [{
            name: labelMap[ebarimtEntityType],
            quantity: 1,
            unitPrice: paidAmount,
            totalAmount: paidAmount,
          }],
          paymentMethod: 'ELECTRONIC',
          orderId,
        });
      } catch {
        console.error('eBarimt receipt creation failed for order:', orderId);
      }
    }

    return NextResponse.json({
      success: true,
      amount: paidAmount,
      ebarimt: ebarimtResult?.success ? {
        receiptId: ebarimtResult.receiptId,
        qrData: ebarimtResult.qrData,
        lottery: ebarimtResult.lottery,
      } : null,
    });
  } catch {
    return NextResponse.json({ error: 'Payment verification failed' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
