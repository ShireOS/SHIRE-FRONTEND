import Constants from 'expo-constants';
import { getCurrentAccessToken, getSBClient } from '../../packages/supabase';

export function getApiBaseUrl() {
  const value = Constants.expoConfig?.extra?.apiBaseUrl;
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error('API_BASE_URL is not configured for the mobile app.');
  }
  return value.replace(/\/+$/, '');
}

export function getReservationsApiBaseUrl() {
  const value = Constants.expoConfig?.extra?.reservationsApiBaseUrl || Constants.expoConfig?.extra?.apiBaseUrl;
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error('RESERVATIONS_API_BASE_URL or API_BASE_URL is not configured for the mobile app.');
  }
  return value.replace(/\/+$/, '');
}

export function getPosApiBaseUrl() {
  const value = Constants.expoConfig?.extra?.posApiBaseUrl;
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error('POS_API_BASE_URL is not configured for the mobile app.');
  }
  const configured = value.replace(/\/+$/, '').replace(/\/dev-v2$/, '');
  const apiBase = configured.endsWith('/api/v1') ? configured : `${configured}/api/v1`;
  return `${apiBase}/dev-v2`;
}

type ApiAuthMode = 'supabase' | 'none';

type ApiRequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  auth?: ApiAuthMode;
  headers?: Record<string, string>;
};

export class ApiRequestError extends Error {
  status: number;
  detail: unknown;

  constructor(message: string, status: number, detail: unknown) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.detail = detail;
  }
}

async function resolveAuthorization(auth: ApiAuthMode) {
  if (auth === 'none') return null;

  const accessToken = getCurrentAccessToken();
  if (accessToken) return `Bearer ${accessToken}`;

  const client = getSBClient();
  const {
    data: { session },
    error,
  } = await client.auth.getSession();

  if (error) throw error;
  return session?.access_token ? `Bearer ${session.access_token}` : null;
}

export async function apiRequest<T>(endpoint: string, options: ApiRequestOptions = {}): Promise<T> {
  return apiRequestFromBase<T>(getApiBaseUrl(), endpoint, options);
}

export async function reservationsApiRequest<T>(endpoint: string, options: ApiRequestOptions = {}): Promise<T> {
  return apiRequestFromBase<T>(getReservationsApiBaseUrl(), endpoint, options);
}

export async function posApiRequest<T>(
  restaurantId: string,
  endpoint: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  return apiRequestFromBase<T>(getPosApiBaseUrl(), endpoint, {
    ...options,
    headers: {
      ...options.headers,
      'X-Restaurant-Id': restaurantId,
      'X-Client-Version': Constants.expoConfig?.version || 'unknown',
    },
  });
}

async function apiRequestFromBase<T>(baseUrl: string, endpoint: string, options: ApiRequestOptions = {}): Promise<T> {
  const authorization = await resolveAuthorization(options.auth ?? 'supabase');
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...options.headers,
  };
  if (authorization) headers.Authorization = authorization;
  if (options.body !== undefined && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${baseUrl}${endpoint}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined
      ? undefined
      : options.body instanceof FormData
        ? options.body
        : JSON.stringify(options.body),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const detail = typeof body.detail === 'string'
      ? body.detail
      : typeof body.message === 'string'
        ? body.message
        : body.detail
          ? JSON.stringify(body.detail)
          : `Request failed (${response.status})`;
    throw new ApiRequestError(detail, response.status, body.detail ?? body.message ?? null);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function apiGet<T>(endpoint: string): Promise<T> {
  return apiRequest<T>(endpoint);
}

export async function apiPost<T>(endpoint: string, body?: unknown): Promise<T> {
  return apiRequest<T>(endpoint, { method: 'POST', body });
}

export async function apiPatch<T>(endpoint: string, body?: unknown): Promise<T> {
  return apiRequest<T>(endpoint, { method: 'PATCH', body });
}
