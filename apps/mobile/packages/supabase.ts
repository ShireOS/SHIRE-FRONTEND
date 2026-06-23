import 'react-native-url-polyfill/auto'

import AsyncStorage from '@react-native-async-storage/async-storage'
import { initClient, getClient } from "@shire/db"
import Constants from 'expo-constants'

export type userRole = "owner" | "employee" | "developer" | null

export type OwnerRestaurant = {
    id: string
    name: string
    role: string
}

export function getSBClient() {
    const { supabaseUrl, supabasePublishableKey } = Constants.expoConfig?.extra ?? {}

    try {
        return getClient()
    } catch (e) {
        initClient({
            url: supabaseUrl,
            anonKey: supabasePublishableKey,
            auth: {
                storage: AsyncStorage,
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: false,
            },
        })
        return getClient()
    }
}

export type LoginResult =
    | { ok: true; role: userRole }
    | { ok: false; error: string }

export async function login(email: string, password: string): Promise<LoginResult> {
    try {
        const client = getSBClient()
        const { data, error } = await client.auth.signInWithPassword({ email, password })
        if (error) return { ok: false, error: humanizeAuthError(error.message) }

        const role = await getUserRole(data.user?.id)
        return { ok: true, role }
    } catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        return { ok: false, error: humanizeAuthError(message) }
    }
}

export async function getStoredUserRole(): Promise<userRole> {
    const client = getSBClient()
    const { data, error } = await client.auth.getSession()
    if (error) throw error
    if (!data.session?.user.id) return null
    return getUserRole(data.session.user.id)
}

function humanizeAuthError(raw: string): string {
    const m = raw.toLowerCase()
    if (m.includes('invalid login') || m.includes('invalid credentials')) {
        return 'Incorrect email or password.'
    }
    if (m.includes('email not confirmed')) {
        return 'Please confirm your email before signing in.'
    }
    if (m.includes('rate') && m.includes('limit')) {
        return 'Too many attempts. Try again in a minute.'
    }
    if (m.includes('network') || m.includes('fetch') || m.includes('failed to fetch')) {
        return 'Network error. Check your connection and try again.'
    }
    return raw || 'Something went wrong. Please try again.'
}

export async function getUserRole(userId?: string): Promise<userRole> {
    const client = getSBClient()
    const resolvedUserId = userId ?? (await client.auth.getSession()).data.session?.user.id

    if (!resolvedUserId) return null

    const roleRequest = client
        .from("user_roles")
        .select("restaraunt_role")
        .eq("user", resolvedUserId)
        .maybeSingle()

    const membershipRequest = client
        .from("restaurant_members")
        .select("role,status")
        .eq("user_id", resolvedUserId)
        .in("status", ["accepted", "active"])
        .limit(1)

    const [{ data: roleData, error: roleError }, { data: memberships, error: membershipError }] =
        await Promise.all([roleRequest, membershipRequest])

    if (!roleError && roleData?.restaraunt_role) return roleData.restaraunt_role

    if (membershipError) {
        if (roleError) throw roleError
        throw membershipError
    }

    const membership = memberships?.[0]
    if (!membership) return null

    const membershipRole = membership.role?.toLowerCase()
    if (membershipRole === "owner" || membershipRole === "admin") {
        return "owner"
    }
    if (membershipRole === "developer") return "developer"
    return "employee"
}

export async function getOwnerRestaurant(): Promise<OwnerRestaurant | null> {
    const client = getSBClient()
    const { data: sessionData, error: sessionError } = await client.auth.getSession()
    if (sessionError) throw sessionError

    const userId = sessionData.session?.user.id
    if (!userId) return null

    const { data: memberships, error: membershipError } = await client
        .from("restaurant_members")
        .select("restaurant_id,role,status")
        .eq("user_id", userId)
        .in("status", ["accepted", "active"])
        .in("role", ["owner", "admin", "developer"])
        .limit(5)

    if (membershipError) throw membershipError
    const membership = memberships?.[0]
    if (!membership?.restaurant_id) return null

    const { data: restaurant, error: restaurantError } = await client
        .from("restaurants")
        .select("id,name")
        .eq("id", membership.restaurant_id)
        .maybeSingle()

    if (restaurantError) throw restaurantError

    return {
        id: membership.restaurant_id,
        name: restaurant?.name || "Restaurant",
        role: membership.role,
    }
}
