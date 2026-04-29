import type { BackendRequestOptions } from './types';

export class APIError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'APIError';
    this.status = status;
  }
}

export async function request<T>(
  baseUrl: string,
  endpoint: string,
  options: BackendRequestOptions = {},
  authToken?: string,
): Promise<T> {
  const url = `${baseUrl}${endpoint}`;
  const headers: HeadersInit = {
    ...(!options.skipJsonContentType ? { 'Content-Type': 'application/json' } : {}),
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    ...options.headers,
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new APIError(response.status, error.detail || error.error || 'Request failed');
  }

  if (response.status === 204) return undefined as T;
  const text = await response.text();
  if (!text) return undefined as T;

  try {
    return JSON.parse(text) as T;
  } catch {
    return text as T;
  }
}
