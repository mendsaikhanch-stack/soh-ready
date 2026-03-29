// QPay v2 API client — server-side only
const BASE_URL = process.env.QPAY_BASE_URL!;
const USERNAME = process.env.QPAY_USERNAME!;
const PASSWORD = process.env.QPAY_PASSWORD!;
const INVOICE_CODE = process.env.QPAY_INVOICE_CODE!;

let cachedToken: { access_token: string; refresh_token: string; expires_at: number } | null = null;

// Auth token авах
async function getToken(): Promise<string> {
  // Cached token шалгах
  if (cachedToken && Date.now() < cachedToken.expires_at) {
    return cachedToken.access_token;
  }

  // Refresh token-р шинэчлэх
  if (cachedToken?.refresh_token) {
    try {
      const res = await fetch(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${cachedToken.refresh_token}` },
      });
      if (res.ok) {
        const data = await res.json();
        cachedToken = {
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          expires_at: Date.now() + (data.expires_in - 60) * 1000,
        };
        return cachedToken.access_token;
      }
    } catch {}
  }

  // Шинээр token авах
  const basicAuth = Buffer.from(`${USERNAME}:${PASSWORD}`).toString('base64');
  const res = await fetch(`${BASE_URL}/auth/token`, {
    method: 'POST',
    headers: { 'Authorization': `Basic ${basicAuth}` },
  });

  if (!res.ok) {
    throw new Error(`QPay auth failed: ${res.status}`);
  }

  const data = await res.json();
  cachedToken = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + (data.expires_in - 60) * 1000,
  };

  return cachedToken.access_token;
}

// Invoice үүсгэх
export async function createInvoice(params: {
  amount: number;
  description: string;
  senderInvoiceNo: string;
  callbackUrl: string;
}) {
  const token = await getToken();

  const res = await fetch(`${BASE_URL}/invoice`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      invoice_code: INVOICE_CODE,
      sender_invoice_no: params.senderInvoiceNo,
      invoice_description: params.description,
      amount: params.amount,
      callback_url: params.callbackUrl,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`QPay invoice failed: ${res.status} ${err}`);
  }

  return res.json();
}

// Төлбөр шалгах
export async function checkPayment(invoiceId: string) {
  const token = await getToken();

  const res = await fetch(`${BASE_URL}/payment/check`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      object_type: 'INVOICE',
      object_id: invoiceId,
      offset: { page_number: 1, page_limit: 100 },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`QPay check failed: ${res.status} ${err}`);
  }

  return res.json();
}

// Invoice цуцлах
export async function cancelInvoice(invoiceId: string) {
  const token = await getToken();

  const res = await fetch(`${BASE_URL}/invoice/${invoiceId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` },
  });

  return res.ok;
}
