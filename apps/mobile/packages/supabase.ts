import { Database, initClient, getClient, Restaurant } from "@shire/db"
import Constants from 'expo-constants'

export type userRole = "owner" | "employee" | "developer" | null

export function getSBClient() {
    const { supabaseUrl, supabasePublishableKey } = Constants.expoConfig?.extra ?? {}

    try {
        return getClient()
    } catch (e) {
        initClient({
            url: supabaseUrl,
            anonKey: supabasePublishableKey,
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
        const { error } = await client.auth.signInWithPassword({ email, password })
        if (error) return { ok: false, error: humanizeAuthError(error.message) }

        const role = (await getUserRole()) ?? null
        return { ok: true, role }
    } catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        return { ok: false, error: humanizeAuthError(message) }
    }
}

export type SignUpResult =
    | { ok: true; needsConfirmation: boolean }
    | { ok: false; error: string }

export async function signUp(email: string, password: string): Promise<SignUpResult> {
    try {
        const client = getSBClient()
        const { data, error } = await client.auth.signUp({ email, password })
        if (error) return { ok: false, error: humanizeAuthError(error.message) }
        return { ok: true, needsConfirmation: data.session == null }
    } catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        return { ok: false, error: humanizeAuthError(message) }
    }
}

function humanizeAuthError(raw: string): string {
    const m = raw.toLowerCase()
    if (m.includes('invalid login') || m.includes('invalid credentials')) {
        return 'Incorrect email or password.'
    }
    if (m.includes('email not confirmed')) {
        return 'Please confirm your email before signing in.'
    }
    if (m.includes('already registered') || m.includes('already exists') || m.includes('user already')) {
        return 'An account with this email already exists. Try signing in instead.'
    }
    if (m.includes('password') && (m.includes('short') || m.includes('at least'))) {
        return 'Password must be at least 6 characters.'
    }
    if (m.includes('unable to validate email') || m.includes('invalid email')) {
        return 'That doesn’t look like a valid email address.'
    }
    if (m.includes('rate') && m.includes('limit')) {
        return 'Too many attempts. Try again in a minute.'
    }
    if (m.includes('network') || m.includes('fetch') || m.includes('failed to fetch')) {
        return 'Network error. Check your connection and try again.'
    }
    return raw || 'Something went wrong. Please try again.'
}

export async function getUserRole(): Promise<userRole | undefined> {
    const client = getSBClient()
    const user = await client.auth.getUser()

    if (user.data.user == null) return

    const data = await client.from("user_roles").select("*").eq("user", user.data.user.id)

    if (data.data == null && data.count == 0) return
    console.log(data.data, user.data.user.id)
    return data.data[0].restaraunt_role
}

export async function getUserRestaraunts(): Promise<Restaurant[] | undefined> {
    const client = getSBClient()
    const user = await client.auth.getUser()

    if (user.data.user == null) return

    const data = await client.from("restaraunt_assignments").select("*").eq("user", user.data.user.id)
    if (data.data == null) return

    const restaraunt_ids = data.data.map((rest) => rest.restaraunt ?? "")
    const restaraunts = await client.from("restaurants").select("*").contains("id", restaraunt_ids)

    if (restaraunts.data == null) return
    return restaraunts.data
}