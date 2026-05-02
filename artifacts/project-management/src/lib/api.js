let _tokenGetter = null;

export function setTokenGetter(getter) {
  _tokenGetter = getter;
}

export async function apiFetch(path, options = {}) {
  const token = _tokenGetter ? await _tokenGetter() : null;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(path, { ...options, headers });
  if (!res.ok) {
    let errMsg = `HTTP ${res.status}`;
    try {
      const err = await res.json();
      errMsg = err.error || err.message || errMsg;
    } catch { /* ignore */ }
    throw new Error(errMsg);
  }
  if (res.status === 204) return null;
  return res.json();
}
