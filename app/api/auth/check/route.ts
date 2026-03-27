import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const type = url.searchParams.get('type') || 'admin';
  const cookieName = type === 'superadmin' ? 'superadmin-session' : type === 'osnaa' ? 'osnaa-session' : type === 'inspector' ? 'inspector-session' : 'admin-session';

  const cookieStore = await cookies();
  const token = cookieStore.get(cookieName)?.value;

  if (!token) {
    return NextResponse.json({ authenticated: false });
  }

  try {
    const parts = token.split(':');
    if (parts.length < 2) {
      return NextResponse.json({ authenticated: false });
    }

    const timestamp = parseInt(parts[0]);
    const maxAge = type === 'superadmin' ? 12 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;

    if (Date.now() - timestamp > maxAge) {
      return NextResponse.json({ authenticated: false });
    }

    // Шинэ 4 хэсэгтэй token: timestamp:sokhId:userId:random
    if (parts.length >= 4) {
      const sokhId = parseInt(parts[1]);
      const userId = parseInt(parts[2]);
      return NextResponse.json({ authenticated: true, sokhId, userId });
    }

    // Хуучин 2 хэсэгтэй token (backward compat)
    return NextResponse.json({ authenticated: true, sokhId: 0, userId: 0 });
  } catch {
    return NextResponse.json({ authenticated: false });
  }
}
