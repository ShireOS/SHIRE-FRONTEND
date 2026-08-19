import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Restaurant } from '@shire/db';

export type userRole = 'owner' | 'employee' | 'developer' | 'reseller' | 'reseller_employee' | 'admin' | null;

export type OwnerRestaurant = {
  id: string;
  name: string;
  role: string;
};

export const RESELLER_UNGROUPED_ID = 'ungrouped';

export type ResellerGroup = {
  id: string;
  reseller_id: string;
  name: string;
  color: string;
};

export type ResellerGroupMember = {
  id: string;
  reseller_id: string;
  group_id: string;
  restaurant_id: string;
};

export type ResellerRestaurant = Restaurant & {
  reseller_group_id: string;
  reseller_group_name: string;
  reseller_group_color: string;
  reseller_permissions: Record<string, boolean>;
};

export type ResellerProfile = {
  reseller_id: string;
  organization_name: string;
  legal_business_name: string | null;
  business_email: string | null;
  phone: string | null;
  website: string | null;
  logo_url: string | null;
  default_general_propagation: 'current_group' | 'current_restaurant' | 'ask_every_time';
  default_specified_propagation: 'current_restaurant' | 'ask_every_time';
  onboarding_completed_at: string | null;
};

export type ResellerEmployee = {
  id: string;
  reseller_id: string;
  user_id: string | null;
  name: string;
  email: string | null;
  username: string;
  status: string;
  permissions: Record<string, boolean>;
  restaurant_ids: string[];
  group_ids: string[];
};

export const DEFAULT_RESELLER_PERMISSIONS = {
  view_analytics: true,
  edit_setup: false,
  propagate_changes: false,
  manage_groups: false,
  close_day: false,
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

function getMobileApiBaseUrl() {
  const value = Constants.expoConfig?.extra?.apiBaseUrl;
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error('API_BASE_URL is not configured for the mobile app.');
  }
  return value.replace(/\/+$/, '');
}

function normalizeResellerProfile(profile: Partial<ResellerProfile> | null | undefined): ResellerProfile {
  return {
    reseller_id: profile?.reseller_id || '',
    organization_name: profile?.organization_name || '',
    legal_business_name: profile?.legal_business_name ?? null,
    business_email: profile?.business_email ?? null,
    phone: profile?.phone ?? null,
    website: profile?.website ?? null,
    logo_url: profile?.logo_url ?? null,
    default_general_propagation: profile?.default_general_propagation || 'current_group',
    default_specified_propagation: profile?.default_specified_propagation || 'current_restaurant',
    onboarding_completed_at: profile?.onboarding_completed_at ?? null,
  };
}

export function isResellerProfileComplete(profile: Partial<ResellerProfile> | null | undefined) {
  return Boolean(
    profile?.organization_name?.trim()
      && profile?.legal_business_name?.trim()
      && profile?.business_email?.trim()
      && profile?.phone?.trim()
      && profile?.default_general_propagation
      && profile?.default_specified_propagation,
  );
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
    let credentialEmail = email.trim();
    const { data: resolvedLogin } = await client.rpc('resolve_reseller_employee_login', {
      login_identifier: credentialEmail,
    });
    if (typeof resolvedLogin === 'string' && resolvedLogin.length > 0) {
      credentialEmail = resolvedLogin;
    }

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
        body: JSON.stringify({ email: credentialEmail, password }),
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

export async function signUp(
  email: string,
  password: string,
  accountType: 'owner' | 'reseller' = 'owner',
): Promise<SignUpResult> {
  try {
    const client = getSBClient();
    const { data, error } = await withTimeout(
      client.auth.signUp({
        email,
        password,
        options: {
          data: { account_type: accountType },
        },
      }),
      'Sign up',
    );
    if (error) return { ok: false, error: humanizeAuthError(error.message ?? '') };
    if (!data.user?.id) return { ok: false, error: 'Error retrieving your information.' };

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

  const [profileRows, roleRows, memberships] = await withTimeout(
    Promise.all([
      fetchJsonWithTimeout<{ account_type?: string }[]>(
        `${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(resolvedUserId)}&select=account_type&limit=1`,
        { headers },
        'Loading account profile',
        ROLE_TIMEOUT_MS,
      ),
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

  const accountType = profileRows[0]?.account_type;
  if (accountType === 'reseller' || accountType === 'reseller_employee' || accountType === 'admin') {
    return accountType;
  }

  const membership = memberships?.[0];
  if (membership) {
    const membershipRole = membership.role?.toLowerCase();
    if (membershipRole === 'owner' || membershipRole === 'admin' || membershipRole === 'manager') return 'owner';
    if (membershipRole === 'developer') return 'developer';
    return 'employee';
  }

  if (roleRows[0]?.restaraunt_role) return roleRows[0].restaraunt_role as userRole;
  return accountType === 'owner' ? 'owner' : null;
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
    `${supabaseUrl}/rest/v1/restaurant_members?user_id=eq.${encodeURIComponent(session.userId)}&status=in.(accepted,active)&role=in.(owner,admin,manager,developer)&select=restaurant_id,role,status&limit=5`,
    { headers },
    'Loading owner restaurant',
    ROLE_TIMEOUT_MS,
  );

  const membership = memberships?.[0];
  if (!membership?.restaurant_id) {
    const owned = await fetchJsonWithTimeout<{ id?: string; name?: string }[]>(
      `${supabaseUrl}/rest/v1/restaurants?owner_id=eq.${encodeURIComponent(session.userId)}&select=id,name&limit=1`,
      { headers },
      'Loading restaurant',
      ROLE_TIMEOUT_MS,
    );
    if (!owned?.[0]?.id) return null;
    return {
      id: owned[0].id,
      name: owned[0].name || 'Restaurant',
      role: 'owner',
    };
  }

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

export async function fetchResellerPortfolio(): Promise<{
  restaurants: ResellerRestaurant[];
  groups: ResellerGroup[];
  memberships: ResellerGroupMember[];
  resellerId: string | null;
  employee: ResellerEmployee | null;
}> {
  const session = await getSessionSnapshot('Loading reseller portfolio');
  if (!session) return { restaurants: [], groups: [], memberships: [], resellerId: null, employee: null };

  const client = getSBClient();
  const role = await getUserRole(session.userId);
  let resellerId = session.userId;
  let employee: ResellerEmployee | null = null;
  let employeeRestaurantIds: Set<string> | null = null;
  let employeeGroupIds: Set<string> | null = null;

  if (role === 'reseller_employee') {
    const { data: employeeRow, error: employeeError } = await client
      .from('reseller_employees')
      .select('*, assignments:reseller_employee_restaurants(restaurant_id), group_assignments:reseller_employee_groups(group_id)')
      .eq('user_id', session.userId)
      .eq('status', 'active')
      .maybeSingle();

    if (employeeError) throw employeeError;
    if (!employeeRow?.id) return { restaurants: [], groups: [], memberships: [], resellerId: null, employee: null };

    employeeRestaurantIds = new Set(((employeeRow.assignments || []) as { restaurant_id: string }[]).map((item) => item.restaurant_id));
    employeeGroupIds = new Set(((employeeRow.group_assignments || []) as { group_id: string }[]).map((item) => item.group_id));
    resellerId = employeeRow.reseller_id;
    employee = {
      id: employeeRow.id,
      reseller_id: employeeRow.reseller_id,
      user_id: employeeRow.user_id,
      name: employeeRow.name,
      email: employeeRow.email,
      username: employeeRow.username,
      status: employeeRow.status,
      permissions: { ...DEFAULT_RESELLER_PERMISSIONS, ...(employeeRow.permissions || {}) },
      restaurant_ids: [...employeeRestaurantIds],
      group_ids: [...employeeGroupIds],
    };
  }

  const [assignmentResult, groupResult, membershipResult] = await withTimeout(
    Promise.all([
      client
        .from('reseller_restaurants')
        .select('permissions, restaurant:restaurants(*)')
        .eq('reseller_id', resellerId)
        .eq('status', 'active'),
      client
        .from('reseller_restaurant_groups')
        .select('*')
        .eq('reseller_id', resellerId)
        .order('name'),
      client
        .from('reseller_restaurant_group_members')
        .select('*')
        .eq('reseller_id', resellerId),
    ]),
    'Loading reseller portfolio',
    ROLE_TIMEOUT_MS,
  );

  if (assignmentResult.error) throw assignmentResult.error;
  if (groupResult.error) throw groupResult.error;
  if (membershipResult.error) throw membershipResult.error;

  const groups = (groupResult.data || []) as ResellerGroup[];
  const memberships = (membershipResult.data || []) as ResellerGroupMember[];
  const membershipByRestaurant = new Map(memberships.map((member) => [member.restaurant_id, member.group_id]));
  if (employeeRestaurantIds && employeeGroupIds) {
    memberships.forEach((membership) => {
      if (employeeGroupIds?.has(membership.group_id)) {
        employeeRestaurantIds?.add(membership.restaurant_id);
      }
    });
  }

  const assignmentRows = (assignmentResult.data || []) as unknown as {
    permissions?: Record<string, boolean> | null;
    restaurant?: Restaurant | Restaurant[] | null;
  }[];
  const restaurants = assignmentRows
    .flatMap((row): ResellerRestaurant[] => {
      const restaurant = Array.isArray(row.restaurant) ? row.restaurant[0] : row.restaurant;
      if (!restaurant) return [];
      const groupId = membershipByRestaurant.get(restaurant.id) || RESELLER_UNGROUPED_ID;
      const group = groups.find((item) => item.id === groupId);
      return [{
        ...restaurant,
        reseller_group_id: groupId,
        reseller_group_name: group?.name || 'Ungrouped',
        reseller_group_color: group?.color || '#9CA3AF',
        reseller_permissions: row.permissions || {},
      }];
    })
    .filter((restaurant) => !employeeRestaurantIds || employeeRestaurantIds.has(restaurant.id));

  return { restaurants, groups, memberships, resellerId, employee };
}

export async function fetchResellerProfile(resellerId: string): Promise<ResellerProfile> {
  const client = getSBClient();
  const { data, error } = await client
    .from('reseller_profiles')
    .select('*')
    .eq('reseller_id', resellerId)
    .maybeSingle();
  if (error) throw error;
  return normalizeResellerProfile(data as Partial<ResellerProfile> | null);
}

async function getCurrentResellerIdForMutation(label: string): Promise<string> {
  const session = await getSessionSnapshot(label);
  if (!session) throw new Error('Not signed in.');
  const client = getSBClient();
  const { data, error } = await client.rpc('current_reseller_id');
  if (error) throw error;
  return typeof data === 'string' && data.length > 0 ? data : session.userId;
}

export async function saveResellerProfile(
  resellerId: string,
  profile: Partial<ResellerProfile>,
  options: { complete?: boolean } = {},
): Promise<ResellerProfile> {
  const client = getSBClient();
  const now = new Date().toISOString();
  const payload = {
    reseller_id: resellerId,
    organization_name: profile.organization_name?.trim() || '',
    legal_business_name: profile.legal_business_name?.trim() || null,
    business_email: profile.business_email?.trim() || null,
    phone: profile.phone?.trim() || null,
    website: profile.website?.trim() || null,
    logo_url: profile.logo_url || null,
    default_general_propagation: profile.default_general_propagation || 'current_group',
    default_specified_propagation: profile.default_specified_propagation || 'current_restaurant',
    onboarding_completed_at: options.complete ? now : profile.onboarding_completed_at || null,
    updated_at: now,
  };
  const { data, error } = await client
    .from('reseller_profiles')
    .upsert(payload, { onConflict: 'reseller_id' })
    .select('*')
    .single();
  if (error) throw error;
  return normalizeResellerProfile(data as Partial<ResellerProfile>);
}

export async function fetchResellerEmployees(resellerId: string): Promise<ResellerEmployee[]> {
  const client = getSBClient();
  const { data, error } = await client
    .from('reseller_employees')
    .select('*, assignments:reseller_employee_restaurants(restaurant_id), group_assignments:reseller_employee_groups(group_id)')
    .eq('reseller_id', resellerId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return ((data || []) as any[]).map((employee) => ({
    id: employee.id,
    reseller_id: employee.reseller_id,
    user_id: employee.user_id,
    name: employee.name,
    email: employee.email,
    username: employee.username,
    status: employee.status,
    permissions: { ...DEFAULT_RESELLER_PERMISSIONS, ...(employee.permissions || {}) },
    restaurant_ids: ((employee.assignments || []) as { restaurant_id: string }[]).map((item) => item.restaurant_id),
    group_ids: ((employee.group_assignments || []) as { group_id: string }[]).map((item) => item.group_id),
  }));
}

export async function createResellerEmployee(input: {
  name: string;
  email: string;
  username?: string;
  restaurant_ids: string[];
  group_ids: string[];
  permissions: Record<string, boolean>;
}): Promise<{ email_sent: boolean; accept_url?: string }> {
  const session = await getSessionSnapshot('Creating reseller employee');
  if (!session) throw new Error('Not signed in.');

  const response = await fetch(`${getMobileApiBaseUrl()}/reseller/employee-invites`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.accessToken}`,
    },
    body: JSON.stringify(input),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof body.detail === 'string' ? body.detail : `Could not invite reseller employee (${response.status})`);
  }
  return body;
}

export async function createResellerGroup(input: { name: string; color: string }): Promise<ResellerGroup> {
  const resellerId = await getCurrentResellerIdForMutation('Creating reseller group');

  const client = getSBClient();
  const { data, error } = await client
    .from('reseller_restaurant_groups')
    .insert({ reseller_id: resellerId, name: input.name.trim(), color: input.color })
    .select('*')
    .single();

  if (error) throw error;
  return data as ResellerGroup;
}

export async function moveRestaurantsToResellerGroup(restaurantIds: string[], groupId: string): Promise<void> {
  const resellerId = await getCurrentResellerIdForMutation('Moving restaurants');

  const ids = Array.from(new Set(restaurantIds)).filter(Boolean);
  if (ids.length === 0) return;

  const client = getSBClient();
  if (groupId === RESELLER_UNGROUPED_ID) {
    const { error } = await client
      .from('reseller_restaurant_group_members')
      .delete()
      .eq('reseller_id', resellerId)
      .in('restaurant_id', ids);
    if (error) throw error;
    return;
  }

  const rows = ids.map((restaurantId) => ({
    reseller_id: resellerId,
    restaurant_id: restaurantId,
    group_id: groupId,
  }));

  const { error } = await client
    .from('reseller_restaurant_group_members')
    .upsert(rows, { onConflict: 'reseller_id,restaurant_id' });
  if (error) throw error;
}
