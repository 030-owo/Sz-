import type { DeviceView, Metrics } from '@sz/shared';

const TOKEN_KEY = 'sz_admin_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(t: string): void {
  localStorage.setItem(TOKEN_KEY, t);
}
export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

async function req<T>(path: string): Promise<T> {
  const res = await fetch(path, {
    headers: { authorization: `Bearer ${getToken() ?? ''}` },
  });
  if (res.status === 401) {
    clearToken();
    throw new Error('unauthorized');
  }
  if (!res.ok) throw new Error(`request failed: ${res.status}`);
  return res.json() as Promise<T>;
}

export async function login(user: string, pass: string): Promise<void> {
  const res = await fetch('/api/v1/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ user, pass }),
  });
  if (!res.ok) throw new Error('帳號或密碼錯誤');
  const { token } = (await res.json()) as { token: string };
  setToken(token);
}

export const fetchDevices = () => req<{ devices: DeviceView[] }>('/api/v1/devices');
export const fetchDevice = (id: string) => req<{ device: DeviceView }>(`/api/v1/devices/${id}`);
export const fetchMetrics = (id: string) =>
  req<{ metrics: (Metrics & { ts: string })[] }>(`/api/v1/devices/${id}/metrics?limit=200`);

export interface LogRow {
  ts: string;
  level: string;
  source: string;
  message: string;
}
export const fetchLogs = (id: string, level?: string) =>
  req<{ logs: LogRow[] }>(`/api/v1/devices/${id}/logs?limit=200${level ? `&level=${level}` : ''}`);
