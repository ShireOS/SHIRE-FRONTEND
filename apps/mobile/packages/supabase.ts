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
        if (error) return { ok: false, error: humanizeAuthError(error.message ?? "") }
        if  (data.user == null || data.user.id == null) return {ok: false, error: "Error retrieving your infromation"}

        client.from("user_roles").insert({
            user: data.user?.id!,
            sole_annotation_access: false,
            restaraunt_role: "employee"
        })
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

export async function uploadUserPfp(base64: string): Promise<{ ok: true } | { ok: false; error: string }> {
    try {
        const client = getSBClient()
        const user = await client.auth.getUser()
        if (user.data.user == null) return { ok: false, error: 'Not signed in.' }
        const userId = user.data.user.id

        const existing = await client
            .from('user_meta')
            .select('user_id')
            .eq('user_id', userId)
            .maybeSingle()

        if (existing.data) {
            const { error } = await client
                .from('user_meta')
                .update({ picture: base64 })
                .eq('user_id', userId)
            if (error) return { ok: false, error: error.message }
        } else {
            const { error } = await client
                .from('user_meta')
                .insert({ user_id: userId, picture: base64 })
            if (error) return { ok: false, error: error.message }
        }
        return { ok: true }
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
}

export async function getUserPfp(): Promise<string | null> {
    try {
        const client = getSBClient()
        const user = await client.auth.getUser()
        if (user.data.user == null) return null

        const { data, error } = await client
            .from('user_meta')
            .select('picture')
            .eq('user_id', user.data.user.id)
            .maybeSingle()
        if (error || !data) return null
        return data.picture ?? null
    } catch {
        return null
    }
}

export async function getUserRole(): Promise<userRole | undefined> {
    const client = getSBClient()
    const user = await client.auth.getUser()

    if (user.data.user == null) return

    const data = await client.from("user_roles").select("*").eq("user", user.data.user.id)

    if (data.data == null && data.count == 0) return
    console.log(data.data, user.data.user.id)
    return data.data![0].restaraunt_role
}

export async function getUserRestaraunts(): Promise<Restaurant[] | undefined> {
    const client = getSBClient()
    const user = await client.auth.getUser()

    if (user.data.user == null) return

    const data = await client.from("restaraunt_assignments").select("*").eq("user", user.data.user.id)
    if (data.data == null) return

    const restaraunt_ids = data.data.map((rest) => rest.restaraunt ?? "")
    const restaraunts = await client.from("restaurants").select("*").in("id", restaraunt_ids)

    if (restaraunts.data == null) return
    return restaraunts.data
}

export async function addUserRequest(join_code: string): Promise<string> {
    const client = getSBClient()
    const user = await client.auth.getUser()
    const restaraunt = await client.from("restaurants").select("*").eq("join_code", join_code)

    if (user.data.user == null) return "user is not authenticated"
    if (restaraunt.data == null || restaraunt.count == 0) return "Restaraunt joining code is invalid"

    await client.from("restaraunt_assignments").insert({
        user: user.data.user.id, 
        approved: false, 
        restaraunt: restaraunt.data[0].id
    })

    return ""
}

export async function getWorkerRequests(restaraunt_id: string): Promise<any> {
    const client = getSBClient()
    const user = await client.auth.getUser()
    const restaraunt = await client.from("restaurants").select("*").eq("id", restaraunt_id)

    if (user.data.user == null) return "user is not authenticated"
    if (restaraunt.data == null || restaraunt.count == 0) return "Restaraunt id is invalid"

    let pending_users = await client.from("restaraunt_assignments").select("*").eq("restaraunt", restaraunt_id).eq("approved", false)
    if (pending_users.data == null || pending_users.count == 0) return []

    let final_pending_users = await client.from("user_meta").select("*").in("user_id", pending_users.data.map((user) => user.user))
    if (final_pending_users.data == null || final_pending_users.count == 0) return []

    return final_pending_users
}