import Constants from 'expo-constants';
import { getSBClient } from '../../packages/supabase';

function getApiBaseUrl() {
  const value = Constants.expoConfig?.extra?.apiBaseUrl;
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error('API_BASE_URL is not configured for the mobile app.');
  }
  return value.replace(/\/+$/, '');
}

export async function apiGet<T>(endpoint: string): Promise<T> {
  const client = getSBClient();
  const {
    data: { session },
    error,
  } = await client.auth.getSession();

  if (error) throw error;

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }

  const response = await fetch(`${getApiBaseUrl()}${endpoint}`, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const detail = typeof body.detail === 'string'
      ? body.detail
      : typeof body.message === 'string'
        ? body.message
        : `Request failed (${response.status})`;
    throw new Error(detail);
  }

  return response.json() as Promise<T>;
}
