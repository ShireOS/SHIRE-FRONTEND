import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Restaurant } from '@shire/db';

export type userRole = 'owner' | 'employee' | 'developer' | null;

export type OwnerRestaurant = {
  id: string;
  name: string;
  role: string;
};

const AUTH_TIMEOUT_MS = 12_000;
const ROLE_TIMEOUT_MS = 8_000;
let mobileSupabaseClient: SupabaseClient | null = null;
let currentAccessToken: string | null = null;
let currentRefreshToken: string | null = null;
let currentUserId: string | null = null;

function syncSessionSnapshot(session: {
  access_token?: string | null;
  refresh_token?: string | null;
  user?: { id?: string | null } | null;
} | null) {
  currentAccessToken = session?.access_token ?? null;
  currentRefreshToken = session?.refresh_token ?? null;
  currentUserId = session?.user?.id ?? null;
}

function withTimeout<T>(promise: PromiseLike<T>, label: string, ms = AUTH_TIMEOUT_MS): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${label} timed out after ${Math.round(ms / 1000)} seconds.`));
    }, ms);
  });

  return Promise.race([Promise.resolve(promise), timeout]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}

function getSupabaseConfig() {
  const { supabaseUrl, supabasePublishableKey } = Constants.expoConfig?.extra ?? {};

  if (typeof supabaseUrl !== 'string' || supabaseUrl.length === 0) {
    throw new Error('SUPABASE_URL is not configured for the mobile app.');
  }
  if (typeof supabasePublishableKey !== 'string' || supabasePublishableKey.length === 0) {
    throw new Error('SUPABASE_PUBLISHABLE_KEY is not configured for the mobile app.');
  }

  return { supabaseUrl: supabaseUrl.replace(/\/+$/, ''), supabasePublishableKey };
}

async function fetchJsonWithTimeout<T>(
  url: string,
  init: RequestInit,
  label: string,
  ms = AUTH_TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    timeoutId = setTimeout(() => controller.abort(), ms);
    const response = await fetch(url, { ...init, signal: controller.signal });
    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      const message = typeof body.error_description === 'string'
        ? body.error_description
        : typeof body.msg === 'string'
          ? body.msg
          : typeof body.message === 'string'
            ? body.message
            : `${label} failed (${response.status})`;
      throw new Error(message);
    }

    return body as T;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`${label} timed out after ${Math.round(ms / 1000)} seconds.`);
    }
    throw err;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export function getSBClient() {
  const { supabaseUrl, supabasePublishableKey } = getSupabaseConfig();

  if (mobileSupabaseClient) return mobileSupabaseClient;

  mobileSupabaseClient = createClient(supabaseUrl, supabasePublishableKey, {
    auth: {
      storage: AsyncStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });

  mobileSupabaseClient.auth.onAuthStateChange((_event, session) => {
    syncSessionSnapshot(session);
  });

  return mobileSupabaseClient;
}

export function getCurrentAccessToken() {
  return currentAccessToken;
}

export function getCurrentUserId() {
  return currentUserId;
}

async function getSessionSnapshot(label = 'Loading Supabase session') {
  if (currentUserId && currentAccessToken) {
    return { userId: currentUserId, accessToken: currentAccessToken };
  }

  const client = getSBClient();
  const { data, error } = await withTimeout(client.auth.getSession(), label, ROLE_TIMEOUT_MS);
  if (error) throw error;
  if (!data.session?.user.id || !data.session.access_token) return null;

  syncSessionSnapshot(data.session);

  return { userId: data.session.user.id, accessToken: data.session.access_token };
}

export type LoginResult =
  | { ok: true; role: userRole }
  | { ok: false; error: string };

export async function login(email: string, password: string): Promise<LoginResult> {
  try {
    const { supabaseUrl, supabasePublishableKey } = getSupabaseConfig();
    const client = getSBClient();

    const data = await fetchJsonWithTimeout<{
      access_token?: string;
      refresh_token?: string;
      user?: { id?: string };
    }>(
      `${supabaseUrl}/auth/v1/token?grant_type=password`,
      {
        method: 'POST',
        headers: {
          apikey: supabasePublishableKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      },
      'Sign in',
    );

    if (!data.access_token || !data.refresh_token || !data.user?.id) {
      return { ok: false, error: 'Supabase did not return a valid session.' };
    }

    syncSessionSnapshot({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      user: { id: data.user.id },
    });

    await withTimeout(
      client.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      }),
      'Saving Supabase session',
      3_000,
    ).catch(() => undefined);

    const role = await getUserRole(data.user.id);
    return { ok: true, role };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, error: humanizeAuthError(message) };
  }
}

export type SignUpResult =
  | { ok: true; needsConfirmation: boolean }
  | { ok: false; error: string };

export async function signUp(email: string, password: string): Promise<SignUpResult> {
  try {
    const client = getSBClient();
    const { data, error } = await withTimeout(
      client.auth.signUp({ email, password }),
      'Sign up',
    );
    if (error) return { ok: false, error: humanizeAuthError(error.message ?? '') };
    if (!data.user?.id) return { ok: false, error: 'Error retrieving your information.' };

    const { error: roleError } = await withTimeout(
      client.from('user_roles').insert({
        user: data.user.id,
        sole_annotation_access: false,
        restaraunt_role: 'employee',
      }),
      'Saving account role',
    );
    if (roleError) return { ok: false, error: roleError.message };

    return { ok: true, needsConfirmation: data.session == null };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, error: humanizeAuthError(message) };
  }
}

export async function getStoredUserRole(): Promise<userRole> {
  const session = await getSessionSnapshot('Restoring session');
  if (!session) return null;
  return getUserRole(session.userId);
}

function humanizeAuthError(raw: string): string {
  const m = raw.toLowerCase();
  if (m.includes('invalid login') || m.includes('invalid credentials')) {
    return 'Incorrect email or password.';
  }
  if (m.includes('email not confirmed')) {
    return 'Please confirm your email before signing in.';
  }
  if (m.includes('already registered') || m.includes('already exists') || m.includes('user already')) {
    return 'An account with this email already exists. Try signing in instead.';
  }
  if (m.includes('password') && (m.includes('short') || m.includes('at least'))) {
    return 'Password must be at least 6 characters.';
  }
  if (m.includes('unable to validate email') || m.includes('invalid email')) {
    return 'That doesn’t look like a valid email address.';
  }
  if (m.includes('rate') && m.includes('limit')) {
    return 'Too many attempts. Try again in a minute.';
  }
  if (m.includes('timed out')) {
    if (m.includes('account role') || m.includes('membership')) {
      return 'Signed in, but loading your role took too long. Try again.';
    }
    return 'Supabase sign-in took too long. Check your connection and try again.';
  }
  if (m.includes('network') || m.includes('fetch') || m.includes('failed to fetch')) {
    return 'Network error. Check your connection and try again.';
  }
  return raw || 'Something went wrong. Please try again.';
}

export async function uploadUserPfp(base64: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const client = getSBClient();
    const user = await client.auth.getUser();
    if (!user.data.user) return { ok: false, error: 'Not signed in.' };
    const userId = user.data.user.id;

    const existing = await client
      .from('user_meta')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (existing.data) {
      const { error } = await client
        .from('user_meta')
        .update({ picture: base64 })
        .eq('user_id', userId);
      if (error) return { ok: false, error: error.message };
    } else {
      const { error } = await client
        .from('user_meta')
        .insert({ user_id: userId, picture: base64 });
      if (error) return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function getUserPfp(): Promise<string | null> {
  try {
    const client = getSBClient();
    const user = await client.auth.getUser();
    if (!user.data.user) return null;

    const { data, error } = await client
      .from('user_meta')
      .select('picture')
      .eq('user_id', user.data.user.id)
      .maybeSingle();
    if (error || !data) return null;
    return data.picture ?? null;
  } catch {
    return null;
  }
}

export async function getUserRole(userId?: string): Promise<userRole> {
  const { supabaseUrl, supabasePublishableKey } = getSupabaseConfig();
  let accessToken = currentAccessToken;
  let resolvedUserId = userId ?? currentUserId;

  if (!resolvedUserId || !accessToken) {
    const session = await getSessionSnapshot('Loading session role');
    resolvedUserId = resolvedUserId ?? session?.userId ?? null;
    accessToken = accessToken ?? session?.accessToken ?? null;
  }

  if (!resolvedUserId) return null;
  if (!accessToken) throw new Error('Supabase session is missing an access token.');

  const headers = {
    apikey: supabasePublishableKey,
    Authorization: `Bearer ${accessToken}`,
  };

  const [roleRows, memberships] = await withTimeout(
    Promise.all([
      fetchJsonWithTimeout<{ restaraunt_role?: string }[]>(
        `${supabaseUrl}/rest/v1/user_roles?user=eq.${encodeURIComponent(resolvedUserId)}&select=restaraunt_role&limit=1`,
        { headers },
        'Loading account role',
        ROLE_TIMEOUT_MS,
      ),
      fetchJsonWithTimeout<{ role?: string; status?: string }[]>(
        `${supabaseUrl}/rest/v1/restaurant_members?user_id=eq.${encodeURIComponent(resolvedUserId)}&status=in.(accepted,active)&select=role,status&limit=1`,
        { headers },
        'Loading account membership',
        ROLE_TIMEOUT_MS,
      ),
    ]),
    'Loading account role',
    ROLE_TIMEOUT_MS,
  );

  if (roleRows[0]?.restaraunt_role) {
    return roleRows[0].restaraunt_role as userRole;
  }

  const membership = memberships?.[0];
  if (!membership) return null;

  const membershipRole = membership.role?.toLowerCase();
  if (membershipRole === 'owner' || membershipRole === 'admin') return 'owner';
  if (membershipRole === 'developer') return 'developer';
  return 'employee';
}

export async function getOwnerRestaurant(): Promise<OwnerRestaurant | null> {
  const { supabaseUrl, supabasePublishableKey } = getSupabaseConfig();
  const session = await getSessionSnapshot('Loading owner restaurant');
  if (!session) return null;

  const headers = {
    apikey: supabasePublishableKey,
    Authorization: `Bearer ${session.accessToken}`,
  };

  const memberships = await fetchJsonWithTimeout<{
    restaurant_id?: string;
    role?: string;
    status?: string;
  }[]>(
    `${supabaseUrl}/rest/v1/restaurant_members?user_id=eq.${encodeURIComponent(session.userId)}&status=in.(accepted,active)&role=in.(owner,admin,developer)&select=restaurant_id,role,status&limit=5`,
    { headers },
    'Loading owner restaurant',
    ROLE_TIMEOUT_MS,
  );

  const membership = memberships?.[0];
  if (!membership?.restaurant_id) return null;

  const restaurants = await fetchJsonWithTimeout<{ id?: string; name?: string }[]>(
    `${supabaseUrl}/rest/v1/restaurants?id=eq.${encodeURIComponent(membership.restaurant_id)}&select=id,name&limit=1`,
    { headers },
    'Loading restaurant',
    ROLE_TIMEOUT_MS,
  );

  return {
    id: membership.restaurant_id,
    name: restaurants[0]?.name || 'Restaurant',
    role: membership.role ?? 'owner',
  };
}

export async function getUserRestaraunts(): Promise<Restaurant[] | undefined> {
  const client = getSBClient();
  const user = await client.auth.getUser();

  if (!user.data.user) return undefined;

  const data = await client.from('restaraunt_assignments').select('*').eq('user', user.data.user.id);
  if (!data.data) return undefined;

  const restarauntIds = data.data.map((rest) => rest.restaraunt ?? '');
  const restaraunts = await client.from('restaurants').select('*').in('id', restarauntIds);

  if (!restaraunts.data) return undefined;
  return restaraunts.data as Restaurant[];
}

export async function addUserRequest(join_code: string): Promise<string> {
  const client = getSBClient();
  const user = await client.auth.getUser();
  const restaraunt = await client.from('restaurants').select('*').eq('join_code', join_code);

  if (!user.data.user) return 'user is not authenticated';
  if (!restaraunt.data || restaraunt.count === 0) return 'Restaraunt joining code is invalid';

  await client.from('restaraunt_assignments').insert({
    user: user.data.user.id,
    approved: false,
    restaraunt: restaraunt.data[0].id,
  });

  return '';
}

export async function getWorkerRequests(restaraunt_id: string): Promise<any> {
  const client = getSBClient();
  const user = await client.auth.getUser();
  const restaraunt = await client.from('restaurants').select('*').eq('id', restaraunt_id);

  if (!user.data.user) return 'user is not authenticated';
  if (!restaraunt.data || restaraunt.count === 0) return 'Restaraunt id is invalid';

  const pendingUsers = await client
    .from('restaraunt_assignments')
    .select('*')
    .eq('restaraunt', restaraunt_id)
    .eq('approved', false);
  if (!pendingUsers.data || pendingUsers.count === 0) return [];

  const finalPendingUsers = await client
    .from('user_meta')
    .select('*')
    .in('user_id', pendingUsers.data.map((pendingUser) => pendingUser.user));
  if (!finalPendingUsers.data || finalPendingUsers.count === 0) return [];

  return finalPendingUsers;
}
