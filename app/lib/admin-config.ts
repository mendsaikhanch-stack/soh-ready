let cachedSokhId: number | null = null;

export async function getAdminSokhId(): Promise<number> {
  if (cachedSokhId) return cachedSokhId;

  try {
    const res = await fetch('/api/auth/check?type=admin');
    const data = await res.json();
    if (data.authenticated && data.sokhId) {
      cachedSokhId = data.sokhId;
      return data.sokhId;
    }
  } catch {}

  // OSNAA session-с шалгах
  try {
    const res = await fetch('/api/auth/check?type=osnaa');
    const data = await res.json();
    if (data.authenticated && data.sokhId) {
      cachedSokhId = data.sokhId;
      return data.sokhId;
    }
  } catch {}

  return 0;
}

export function clearAdminSokhIdCache() {
  cachedSokhId = null;
}
