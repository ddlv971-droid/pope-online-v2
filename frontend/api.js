
export const API_BASE = window.API_BASE || localStorage.getItem('pope_api_base') || 'http://localhost:8787';

export function getToken() {
  return localStorage.getItem('pope_token') || '';
}

export function setToken(token) {
  if (token) localStorage.setItem('pope_token', token);
  else localStorage.removeItem('pope_token');
}

export async function apiFetch(path, { method='GET', body=null, auth=true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const t = getToken();
    if (t) headers['Authorization'] = `Bearer ${t}`;
  }
  const res = await fetch(`${API_BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : null });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
  if (!res.ok) {
    const err = new Error(data?.error || 'api_error');
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}
