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
  } catch (err) {
    console.error('Admin auth check failed:', err instanceof Error ? err.message : 'Unknown error');
  }

  // OSNAA session-с шалгах
  try {
    const res = await fetch('/api/auth/check?type=osnaa');
    const data = await res.json();
    if (data.authenticated && data.sokhId) {
      cachedSokhId = data.sokhId;
      return data.sokhId;
    }
  } catch (err) {
    console.error('OSNAA auth check failed:', err instanceof Error ? err.message : 'Unknown error');
  }

  return 0;
}

export function clearAdminSokhIdCache() {
  cachedSokhId = null;
}
