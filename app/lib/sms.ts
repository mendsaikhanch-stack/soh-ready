// SMS адаптер — deferred (QPay/Wire шиг). Провайдер холбогдоогүй үед
// код/линкийг console-д хэвлээд ok=true буцаана (dev горим).
//
// Live болгохын тулд ЗӨВХӨН доорх sendSms() дотор нэг провайдерын
// HTTP дуудлагыг залгана (Мессежпро/Скайтел г.м). CSP-д гадаад
// домэйн нэмэх шаардлагагүй — энэ нь сервер талд ажиллана.

interface SmsResult {
  ok: boolean;
  error?: string;
}

/**
 * Утас руу SMS илгээх. Одоогоор stub — провайдер тохируулаагүй бол
 * зөвхөн console-д хэвлэнэ. SMS_PROVIDER env тавихад live залгана.
 */
export async function sendSms(to: string, message: string): Promise<SmsResult> {
  const provider = process.env.SMS_PROVIDER; // жишээ: 'messagepro'

  if (!provider) {
    console.log(`[SMS→${to}] ${message}`);
    return { ok: true };
  }

  try {
    // TODO: жинхэнэ провайдерыг энд залга. Жишээ бүтэц:
    //
    // const res = await fetch(process.env.SMS_API_URL!, {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //     Authorization: `Bearer ${process.env.SMS_API_KEY}`,
    //   },
    //   body: JSON.stringify({ to, text: message, from: process.env.SMS_SENDER }),
    // });
    // if (!res.ok) return { ok: false, error: `SMS API ${res.status}` };
    // return { ok: true };

    console.warn(`[SMS] '${provider}' провайдер бүрэн залгагдаагүй байна.`);
    console.log(`[SMS→${to}] ${message}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'SMS алдаа' };
  }
}
