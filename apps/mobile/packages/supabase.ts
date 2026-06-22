import { Database, initClient, getClient } from "@shire/db"
import Constants from 'expo-constants'

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

export type LoginResult = { ok: true } | { ok: false; error: string }

export async function login(email: string, password: string): Promise<LoginResult> {
    try {
        const client = getSBClient()
        const { error } = await client.auth.signInWithPassword({ email, password })
        if (error) return { ok: false, error: humanizeAuthError(error.message) }
        return { ok: true }
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
    if (m.includes('rate') && m.includes('limit')) {
        return 'Too many attempts. Try again in a minute.'
    }
    if (m.includes('network') || m.includes('fetch') || m.includes('failed to fetch')) {
        return 'Network error. Check your connection and try again.'
    }
    return raw || 'Something went wrong. Please try again.'
}
