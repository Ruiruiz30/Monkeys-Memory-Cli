import { getApiUrl, getToken, trimTrailingSlash } from './config.js';
import type { JsonObject } from '../types/api.js';

export type ApiRequestOptions = {
  data?: unknown;
  params?: JsonObject;
  tokenRequired?: boolean;
  apiUrl?: string;
};

export async function apiRequest<T = JsonObject>(
  method: string,
  pathName: string,
  { data, params, tokenRequired = true, apiUrl }: ApiRequestOptions = {},
): Promise<T> {
  const base = trimTrailingSlash(apiUrl ?? await getApiUrl());
  const url = new URL(pathName.startsWith('http') ? pathName : `${base}${pathName.startsWith('/') ? pathName : `/${pathName}`}`);
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  }

  const headers: Record<string, string> = { Accept: 'application/json' };
  const token = await getToken();
  if (tokenRequired) {
    if (!token) throw new Error('not logged in; run `monkeys-memory login`');
    headers.Authorization = `Bearer ${token}`;
  } else if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (data !== undefined) headers['Content-Type'] = 'application/json';

  const response = await fetch(url, {
    method,
    headers,
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) as JsonObject : {};
  if (!response.ok) throw new Error(String(body?.error ?? `${method} ${url.pathname} failed (${response.status})`));
  return body as T;
}

export async function apiResponse<T = JsonObject>(
  method: string,
  pathName: string,
  options: ApiRequestOptions = {},
): Promise<{ ok: true; data: T } | { ok: false; error: Error }> {
  try {
    return { ok: true, data: await apiRequest<T>(method, pathName, options) };
  } catch (error) {
    return { ok: false, error: error as Error };
  }
}
