import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { getClient, initClient, type Restaurant } from '@shire/db';

export type userRole = 'owner' | 'employee' | 'developer' | null;

export type OwnerRestaurant = {
  id: string;
  name: string;
  role: string;
};

export function getSBClient() {
  const { supabaseUrl, supabasePublishableKey } = Constants.expoConfig?.extra ?? {};

  try {
    return getClient();
  } catch {
    initClient({
      url: supabaseUrl,
      anonKey: supabasePublishableKey,
      auth: {
        storage: AsyncStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    });
    return getClient();
  }
}

export type LoginResult =
  | { ok: true; role: userRole }
  | { ok: false; error: string };

export async function login(email: string, password: string): Promise<LoginResult> {
  try {
    const client = getSBClient();
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) return { ok: false, error: humanizeAuthError(error.message) };

    const role = await getUserRole(data.user?.id);
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
    const { data, error } = await client.auth.signUp({ email, password });
    if (error) return { ok: false, error: humanizeAuthError(error.message ?? '') };
    if (!data.user?.id) return { ok: false, error: 'Error retrieving your information.' };

    const { error: roleError } = await client.from('user_roles').insert({
      user: data.user.id,
      sole_annotation_access: false,
      restaraunt_role: 'employee',
    });
    if (roleError) return { ok: false, error: roleError.message };

    return { ok: true, needsConfirmation: data.session == null };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, error: humanizeAuthError(message) };
  }
}

export async function getStoredUserRole(): Promise<userRole> {
  const client = getSBClient();
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  if (!data.session?.user.id) return null;
  return getUserRole(data.session.user.id);
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
  const client = getSBClient();
  const resolvedUserId = userId ?? (await client.auth.getSession()).data.session?.user.id;

  if (!resolvedUserId) return null;

  const roleRequest = client
    .from('user_roles')
    .select('restaraunt_role')
    .eq('user', resolvedUserId)
    .maybeSingle();

  const membershipRequest = client
    .from('restaurant_members')
    .select('role,status')
    .eq('user_id', resolvedUserId)
    .in('status', ['accepted', 'active'])
    .limit(1);

  const [{ data: roleData, error: roleError }, { data: memberships, error: membershipError }] =
    await Promise.all([roleRequest, membershipRequest]);

  if (!roleError && roleData?.restaraunt_role) {
    return roleData.restaraunt_role as userRole;
  }

  if (membershipError) {
    if (roleError) throw roleError;
    throw membershipError;
  }

  const membership = memberships?.[0];
  if (!membership) return null;

  const membershipRole = membership.role?.toLowerCase();
  if (membershipRole === 'owner' || membershipRole === 'admin') return 'owner';
  if (membershipRole === 'developer') return 'developer';
  return 'employee';
}

export async function getOwnerRestaurant(): Promise<OwnerRestaurant | null> {
  const client = getSBClient();
  const { data: sessionData, error: sessionError } = await client.auth.getSession();
  if (sessionError) throw sessionError;

  const userId = sessionData.session?.user.id;
  if (!userId) return null;

  const { data: memberships, error: membershipError } = await client
    .from('restaurant_members')
    .select('restaurant_id,role,status')
    .eq('user_id', userId)
    .in('status', ['accepted', 'active'])
    .in('role', ['owner', 'admin', 'developer'])
    .limit(5);

  if (membershipError) throw membershipError;
  const membership = memberships?.[0];
  if (!membership?.restaurant_id) return null;

  const { data: restaurant, error: restaurantError } = await client
    .from('restaurants')
    .select('id,name')
    .eq('id', membership.restaurant_id)
    .maybeSingle();

  if (restaurantError) throw restaurantError;

  return {
    id: membership.restaurant_id,
    name: restaurant?.name || 'Restaurant',
    role: membership.role,
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
