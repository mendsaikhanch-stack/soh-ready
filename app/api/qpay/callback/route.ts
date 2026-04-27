import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase-admin';
import { checkPayment } from '@/app/lib/qpay';
import { createReceipt, isEbarimtConfigured } from '@/app/lib/ebarimt';
import type { EbarimtEntityType } from '@/app/lib/ebarimt';

// QPay callback — төлбөр төлөгдсөн үед QPay дуудна.
// Анхаарал: order_id нь манай үүсгэсэн sender_invoice_no байх ёстой.
// Forge хийхээс сэргийлэхийн тулд тухайн invoice-ыг манай DB-д бүртгэгдсэн эсэх,
// QPay-аас баталгаажсан төлбөр манай хадгалсан amount-той тохирч байгаа эсэхийг шалгана.
export async function GET(request: NextRequest) {
  const orderId = request.nextUrl.searchParams.get('order_id');

  if (!orderId || !/^[a-zA-Z0-9\-_]+$/.test(orderId)) {
    return NextResponse.json({ error: 'Valid order_id required' }, { status: 400 });
  }

  // 1. Манай DB-д бүртгэгдсэн эсэхийг шалгах (forged callback-аас сэргийлнэ)
  const { data: tracked } = await supabaseAdmin
    .from('qpay_invoices')
    .select('id, sender_invoice_no, qpay_invoice_id, sokh_id, resident_id, entity_type, amount, description, status')
    .eq('sender_invoice_no', orderId)
    .single();

  if (!tracked) {
    console.warn('[qpay/callback] unknown order_id', orderId);
    return NextResponse.json({ error: 'Unknown order' }, { status: 404 });
  }

  if (tracked.status === 'paid') {
    return NextResponse.json({ success: true, duplicate: true });
  }

  // 2. QPay-аас баталгаажуулах — манай хадгалсан qpay_invoice_id ашиглана
  try {
    const lookupId = tracked.qpay_invoice_id || tracked.sender_invoice_no;
    const result = await checkPayment(lookupId);
    const paid = result.count > 0 && result.rows?.some(
      (r: { payment_status: string }) => r.payment_status === 'PAID'
    );

    if (!paid) {
      await supabaseAdmin.from('qpay_invoices')
        .update({ callback_received_at: new Date().toISOString() })
        .eq('sender_invoice_no', orderId);
      return NextResponse.json({ error: 'Payment not verified' }, { status: 400 });
    }

    const paidAmount = Number(result.paid_amount || 0);

    // 3. Amount-ыг манай хадгалсан утгатай тулгах (QPay-аас өөр дүн ирсэн бол үл итгэх)
    if (paidAmount < Number(tracked.amount)) {
      console.error('[qpay/callback] amount mismatch', { orderId, tracked: tracked.amount, paid: paidAmount });
      return NextResponse.json({ error: 'Amount mismatch' }, { status: 400 });
    }

    // 4. invoice-ыг paid болгох
    await supabaseAdmin.from('qpay_invoices')
      .update({
        status: 'paid',
        paid_amount: paidAmount,
        paid_at: new Date().toISOString(),
        callback_received_at: new Date().toISOString(),
      })
      .eq('sender_invoice_no', orderId);

    // Баталгаажсан төлбөрийг хадгалах
    await supabaseAdmin.from('payments').insert([{
      amount: paidAmount,
      description: `QPay төлбөр #${orderId}`,
      resident_id: tracked.resident_id || null,
    }]);

    // Платформын комисс бүртгэх
    if (tracked.sokh_id) {
      const sokhId = Number(tracked.sokh_id);
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

    // eBarimt баримт
    let ebarimtResult = null;
    const entityType = (tracked.entity_type as EbarimtEntityType) || 'sokh';
    const entityId = entityType === 'sokh'
      ? (tracked.sokh_id ? Number(tracked.sokh_id) : undefined)
      : undefined; // OSNAA/TSAH-ийн entityId-г trackedlogic-аас хэрэгцээтэй бол өөрчилнө

    if (paidAmount > 0 && await isEbarimtConfigured(entityType, entityId)) {
      try {
        const labelMap: Record<EbarimtEntityType, string> = {
          sokh: 'СӨХ хураамж', osnaa: 'ОСНАА төлбөр', tsah: 'Цахилгааны төлбөр', platform: 'Платформ төлбөр',
        };
        ebarimtResult = await createReceipt({
          entityType,
          entityId,
          amount: paidAmount,
          description: `${labelMap[entityType]} #${orderId}`,
          items: [{
            name: labelMap[entityType],
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
  } catch (err) {
    console.error('[qpay/callback] verify error:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Payment verification failed' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
