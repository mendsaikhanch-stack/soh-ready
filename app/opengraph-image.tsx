import { ImageResponse } from 'next/og';

export const alt = 'Хотол — СӨХ удирдлагын систем';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

async function loadFont(weight: 400 | 700) {
  const url = `https://fonts.googleapis.com/css2?family=Inter:wght@${weight}&subset=cyrillic`;
  const css = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  }).then((r) => r.text());
  const fontUrl = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/)?.[1];
  if (!fontUrl) throw new Error('Inter font URL not found');
  return fetch(fontUrl).then((r) => r.arrayBuffer());
}

export default async function Image() {
  const [interRegular, interBold] = await Promise.all([loadFont(400), loadFont(700)]);

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '80px',
          background: 'linear-gradient(135deg, #2563eb 0%, #4338ca 100%)',
          color: 'white',
          fontFamily: 'Inter',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 18,
              background: 'rgba(255,255,255,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 44,
              fontWeight: 700,
            }}
          >
            Х
          </div>
          <div style={{ fontSize: 36, fontWeight: 700 }}>Хотол</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.1, maxWidth: 900 }}>
            Байрны бүх төлбөр, мэдээлэл нэг дор
          </div>
          <div style={{ fontSize: 32, color: '#bfdbfe', maxWidth: 900 }}>
            СӨХ-ийн төлбөр, зарлал, засвар, тайлан — бүгд нэг апп дээр.
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 28,
          }}
        >
          <div style={{ color: '#bfdbfe' }}>Утсандаа суулгаад ашиглаарай</div>
          <div
            style={{
              background: 'white',
              color: '#2563eb',
              padding: '14px 32px',
              borderRadius: 14,
              fontWeight: 700,
            }}
          >
            Үнэгүй эхлэх →
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: 'Inter', data: interRegular, weight: 400, style: 'normal' },
        { name: 'Inter', data: interBold, weight: 700, style: 'normal' },
      ],
    },
  );
}
