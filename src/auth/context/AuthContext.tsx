import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from 'react'
import { isSupabaseConfigured, supabase, supabaseConfigError } from '../../shared/lib/supabase'
import type { User, Session, AuthError } from '@supabase/supabase-js'
import type { Profile, Restaurant, RestaurantMember } from '../../shared/types/database'
import { isAbortError } from '../utils/authErrors'

const isRestaurantMemberPolicyRecursion = (message: string): boolean =>
  message
    .toLowerCase()
    .includes('infinite recursion detected in policy for relation "restaurant_members"')

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
const AUTH_BOOTSTRAP_GUARD_MS = 12000
const CURRENT_RESTAURANT_STORAGE_KEY = 'shire_current_restaurant'
const AUTH_NOT_CONFIGURED_ERROR =
  supabaseConfigError || '[Supabase] Auth is not configured for this environment.'

const resolveAuthBasePath = (): '/dashboard' | '/host' | '/fake-host-ui' => {
  const pathname = window.location.pathname

  if (pathname.startsWith('/fake-host-ui')) return '/fake-host-ui'
  if (pathname.startsWith('/host')) return '/host'
  return '/dashboard'
}

const createAppAuthUrl = (path: 'callback' | 'reset-password') =>
  `${window.location.origin}${resolveAuthBasePath()}/auth/${path}`

const pickRestaurant = (
  availableRestaurants: Restaurant[],
  activeRestaurant: Restaurant | null,
  persistedRestaurantId: string | null
): Restaurant | null => {
  if (availableRestaurants.length === 0) return null

  if (activeRestaurant) {
    const activeMatch = availableRestaurants.find(r => r.id === activeRestaurant.id)
    if (activeMatch) return activeMatch
  }

  if (persistedRestaurantId) {
    const savedMatch = availableRestaurants.find(r => r.id === persistedRestaurantId)
    if (savedMatch) return savedMatch
  }

  return availableRestaurants[0]
}

// ============================================
// TYPES
// ============================================

interface AuthState {
  user: User | null
  profile: Profile | null
  session: Session | null
  isLoading: boolean
  isAuthenticated: boolean
}

interface RestaurantState {
  currentRestaurant: Restaurant | null
  restaurants: Restaurant[]
  membership: RestaurantMember | null
  isLoading: boolean
}

interface AuthContextValue extends AuthState {
  restaurant: RestaurantState
  // Auth methods
  signUp: (email: string, password: string, metadata?: SignUpMetadata) => Promise<AuthResult>
  signIn: (email: string, password: string) => Promise<AuthResult>
  signInWithGoogle: () => Promise<AuthResult>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<AuthResult>
  updatePassword: (newPassword: string) => Promise<AuthResult>
  // Profile methods
  updateProfile: (updates: Partial<Profile>) => Promise<void>
  // Restaurant methods
  switchRestaurant: (restaurantId: string) => Promise<void>
  refreshRestaurants: () => Promise<void>
}

interface SignUpMetadata {
  first_name?: string
  last_name?: string
  phone?: string
}

interface AuthResult {
  success: boolean
  error?: string
}

// ============================================
// CONTEXT
// ============================================

const AuthContext = createContext<AuthContextValue | null>(null)

// ============================================
// PROVIDER
// ============================================

export function AuthProvider({ children }: { children: ReactNode }) {
  // Auth state
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Restaurant state
  const [currentRestaurant, setCurrentRestaurant] = useState<Restaurant | null>(null)
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [membership, setMembership] = useState<RestaurantMember | null>(null)
  const [restaurantLoading, setRestaurantLoading] = useState(false)

  const initializedRef = useRef(false)
  const membershipQueryDisabledRef = useRef(false)
  const membershipErrorLoggedRef = useRef(false)
  const hydrateRequestRef = useRef(0)

  const handleMembershipError = useCallback((message: string, context: string) => {
    if (isRestaurantMemberPolicyRecursion(message)) {
      membershipQueryDisabledRef.current = true

      if (!membershipErrorLoggedRef.current) {
        membershipErrorLoggedRef.current = true
        console.warn(
          '[Auth] restaurant_members RLS policy is recursive. Membership queries are disabled until policy is fixed:',
          message
        )
      }
      return
    }

    console.warn(`[Auth] ${context}:`, message)
  }, [])

  const resetRestaurantState = useCallback(() => {
    setProfile(null)
    setCurrentRestaurant(null)
    setRestaurants([])
    setMembership(null)
    setRestaurantLoading(false)
    membershipQueryDisabledRef.current = false
    membershipErrorLoggedRef.current = false
    localStorage.removeItem(CURRENT_RESTAURANT_STORAGE_KEY)
  }, [])

  const fetchMembership = useCallback(async (
    restaurantId: string,
    userId: string
  ): Promise<RestaurantMember | null> => {
    if (!isSupabaseConfigured) return null
    if (membershipQueryDisabledRef.current) return null

    const { data: member, error: memberError } = await supabase
      .from('restaurant_members')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('user_id', userId)
      .maybeSingle()

    if (memberError) {
      handleMembershipError(memberError.message, 'Could not fetch membership')
      return null
    }

    return member
  }, [handleMembershipError])

  const getSessionWithRetry = useCallback(async (): Promise<Session | null> => {
    if (!isSupabaseConfigured) return null
    let lastAbortError: unknown = null

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const {
          data: { session: currentSession },
          error: sessionError,
        } = await supabase.auth.getSession()

        if (sessionError) throw sessionError

        return currentSession
      } catch (error) {
        if (!isAbortError(error)) {
          throw error
        }

        lastAbortError = error

        if (attempt < 2) {
          await wait(150)
          continue
        }
      }
    }

    throw lastAbortError || new Error('Failed to get auth session')
  }, [])

  // ----------------------------------------
  // FETCH USER PROFILE
  // ----------------------------------------
  const fetchProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    if (!isSupabaseConfigured) return null
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (error) {
      // Profile might not exist yet for new users — that's OK
      console.warn('[Auth] Could not fetch profile:', error.message)
      return null
    }

    return data
  }, [])

  // ----------------------------------------
  // FETCH USER'S RESTAURANTS
  // ----------------------------------------
  const fetchRestaurants = useCallback(async (userId: string): Promise<Restaurant[]> => {
    if (!isSupabaseConfigured) return []
    setRestaurantLoading(true)

    try {
      // Get restaurants where user is owner
      const { data: ownedRestaurants, error: ownedError } = await supabase
        .from('restaurants')
        .select('*')
        .eq('owner_id', userId)

      if (ownedError) {
        console.warn('[Auth] Could not fetch owned restaurants:', ownedError.message)
      }

      let memberRestaurants: Restaurant[] = []
      if (!membershipQueryDisabledRef.current) {
        const { data: memberships, error: memberError } = await supabase
          .from('restaurant_members')
          .select(`
            *,
            restaurant:restaurants(*)
          `)
          .eq('user_id', userId)
          .eq('status', 'active')

        if (memberError) {
          handleMembershipError(memberError.message, 'Could not fetch memberships (RLS may need setup)')
        } else {
          memberRestaurants = memberships
            ?.map((m: any) => m.restaurant)
            .filter(Boolean) || []
        }
      }

      // Combine owned and member restaurants (dedupe)
      const allRestaurants = [...(ownedRestaurants || [])]

      for (const restaurant of memberRestaurants) {
        if (!allRestaurants.some(owned => owned.id === restaurant.id)) {
          allRestaurants.push(restaurant)
        }
      }

      setRestaurants(allRestaurants)
      return allRestaurants
    } catch (error) {
      console.error('[Auth] Error in fetchRestaurants:', error)
      setRestaurants([])
      return []
    } finally {
      setRestaurantLoading(false)
    }
  }, [handleMembershipError])

  // ----------------------------------------
  // SWITCH RESTAURANT
  // ----------------------------------------
  const switchRestaurant = useCallback(async (restaurantId: string) => {
    const restaurant = restaurants.find(r => r.id === restaurantId)
    if (!restaurant) {
      console.error('[Auth] Restaurant not found:', restaurantId)
      return
    }

    setCurrentRestaurant(restaurant)
    localStorage.setItem(CURRENT_RESTAURANT_STORAGE_KEY, restaurant.id)
  }, [restaurants])

  // ----------------------------------------
  // REFRESH RESTAURANTS
  // ----------------------------------------
  const refreshRestaurants = useCallback(async () => {
    if (!user) return

    const userRestaurants = await fetchRestaurants(user.id)

    if (userRestaurants.length === 0) {
      setCurrentRestaurant(null)
      setMembership(null)
      localStorage.removeItem(CURRENT_RESTAURANT_STORAGE_KEY)
      return
    }

    const savedRestaurantId = localStorage.getItem(CURRENT_RESTAURANT_STORAGE_KEY)
    const restaurantToSelect = pickRestaurant(userRestaurants, currentRestaurant, savedRestaurantId)

    if (restaurantToSelect) {
      setCurrentRestaurant(restaurantToSelect)
      localStorage.setItem(CURRENT_RESTAURANT_STORAGE_KEY, restaurantToSelect.id)
    }
  }, [user, fetchRestaurants, currentRestaurant])

  // Supabase can emit transient abort rejections internally during auth races.
  // Suppress those to avoid noisy uncaught errors in dev console.
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (isAbortError(event.reason)) {
        event.preventDefault()
      }
    }

    window.addEventListener('unhandledrejection', handleUnhandledRejection)
    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
    }
  }, [])

  // ----------------------------------------
  // INITIALIZE AUTH STATE + LISTENERS
  // ----------------------------------------
  useEffect(() => {
    let mounted = true

    if (!isSupabaseConfigured) {
      setIsLoading(false)
      initializedRef.current = true
      console.warn('[Auth] Supabase auth disabled:', AUTH_NOT_CONFIGURED_ERROR)
      return () => {
        mounted = false
      }
    }

    const initializeAuth = async () => {
      try {
        const currentSession = await getSessionWithRetry()

        if (!mounted) return

        setSession(currentSession)
        setUser(currentSession?.user ?? null)
      } catch (error) {
        if (isAbortError(error)) {
          console.warn('[Auth] Initialization aborted; continuing with fallback state.')
        } else {
          console.error('[Auth] Initialization error:', error)
        }
      } finally {
        if (mounted) {
          setIsLoading(false)
          initializedRef.current = true
        }
      }
    }

    void initializeAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return

      console.log('[Auth] State change:', event)

      if (event === 'SIGNED_OUT') {
        setSession(null)
        setUser(null)
        resetRestaurantState()
        return
      }

      setSession(nextSession ?? null)
      setUser(nextSession?.user ?? null)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [getSessionWithRetry, resetRestaurantState])

  // Hydrate user-dependent data outside auth state-change callback.
  useEffect(() => {
    let mounted = true
    const requestId = ++hydrateRequestRef.current
    const userId = user?.id ?? null

    if (!userId) {
      setProfile(null)
      setCurrentRestaurant(null)
      setRestaurants([])
      setMembership(null)
      return () => {
        mounted = false
      }
    }

    const hydrateUserState = async () => {
      const userProfile = await fetchProfile(userId)
      if (!mounted || hydrateRequestRef.current !== requestId) return
      setProfile(userProfile)

      const userRestaurants = await fetchRestaurants(userId)
      if (!mounted || hydrateRequestRef.current !== requestId) return

      const savedRestaurantId = localStorage.getItem(CURRENT_RESTAURANT_STORAGE_KEY)
      const restaurantToSelect = pickRestaurant(userRestaurants, null, savedRestaurantId)

      setCurrentRestaurant(restaurantToSelect)

      if (restaurantToSelect) {
        localStorage.setItem(CURRENT_RESTAURANT_STORAGE_KEY, restaurantToSelect.id)
      } else {
        localStorage.removeItem(CURRENT_RESTAURANT_STORAGE_KEY)
      }
    }

    void hydrateUserState()

    return () => {
      mounted = false
    }
  }, [user?.id, fetchProfile, fetchRestaurants])

  // Keep membership synchronized with selected restaurant.
  useEffect(() => {
    let mounted = true
    const userId = user?.id ?? null
    const restaurantId = currentRestaurant?.id ?? null

    if (!userId || !restaurantId) {
      setMembership(null)
      return () => {
        mounted = false
      }
    }

    const loadMembership = async () => {
      const member = await fetchMembership(restaurantId, userId)
      if (!mounted) return
      setMembership(member)
    }

    void loadMembership()

    return () => {
      mounted = false
    }
  }, [user?.id, currentRestaurant?.id, fetchMembership])

  // Prevent indefinite splash spinner if auth bootstrap gets stuck.
  useEffect(() => {
    if (!isLoading && !restaurantLoading) return

    const timer = setTimeout(() => {
      console.warn('[Auth] Bootstrap guard timeout reached; forcing ready state.')
      initializedRef.current = true
      setIsLoading(false)
      setRestaurantLoading(false)
    }, AUTH_BOOTSTRAP_GUARD_MS)

    return () => {
      clearTimeout(timer)
    }
  }, [isLoading, restaurantLoading])

  // ----------------------------------------
  // AUTH METHODS
  // ----------------------------------------

  const signUp = async (
    email: string,
    password: string,
    metadata?: SignUpMetadata
  ): Promise<AuthResult> => {
    if (!isSupabaseConfigured) {
      return { success: false, error: AUTH_NOT_CONFIGURED_ERROR }
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: metadata?.first_name,
            last_name: metadata?.last_name,
            phone: metadata?.phone,
          },
          emailRedirectTo: createAppAuthUrl('callback'),
        },
      })

      if (error) throw error

      // Check if email confirmation is required
      if (data.user && !data.session) {
        return {
          success: true,
          error: undefined,
        }
      }

      return { success: true }
    } catch (error) {
      const authError = error as AuthError
      return { success: false, error: authError.message }
    }
  }

  const signIn = async (email: string, password: string): Promise<AuthResult> => {
    if (!isSupabaseConfigured) {
      return { success: false, error: AUTH_NOT_CONFIGURED_ERROR }
    }

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      return { success: true }
    } catch (error) {
      const authError = error as AuthError
      return { success: false, error: authError.message }
    }
  }

  const signInWithGoogle = async (): Promise<AuthResult> => {
    if (!isSupabaseConfigured) {
      return { success: false, error: AUTH_NOT_CONFIGURED_ERROR }
    }

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: createAppAuthUrl('callback'),
        },
      })

      if (error) throw error

      return { success: true }
    } catch (error) {
      const authError = error as AuthError
      return { success: false, error: authError.message }
    }
  }

  const signOut = async () => {
    if (!isSupabaseConfigured) {
      setSession(null)
      setUser(null)
      resetRestaurantState()
      return
    }
    await supabase.auth.signOut()
  }

  const resetPassword = async (email: string): Promise<AuthResult> => {
    if (!isSupabaseConfigured) {
      return { success: false, error: AUTH_NOT_CONFIGURED_ERROR }
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: createAppAuthUrl('reset-password'),
      })

      if (error) throw error

      return { success: true }
    } catch (error) {
      const authError = error as AuthError
      return { success: false, error: authError.message }
    }
  }

  const updatePassword = async (newPassword: string): Promise<AuthResult> => {
    if (!isSupabaseConfigured) {
      return { success: false, error: AUTH_NOT_CONFIGURED_ERROR }
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (error) throw error

      return { success: true }
    } catch (error) {
      const authError = error as AuthError
      return { success: false, error: authError.message }
    }
  }

  // ----------------------------------------
  // PROFILE METHODS
  // ----------------------------------------

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!isSupabaseConfigured) throw new Error(AUTH_NOT_CONFIGURED_ERROR)
    if (!user) throw new Error('No user logged in')

    const { error } = await supabase
      .from('profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', user.id)

    if (error) throw error

    // Refresh profile
    const updatedProfile = await fetchProfile(user.id)
    setProfile(updatedProfile)
  }

  // ----------------------------------------
  // CONTEXT VALUE
  // ----------------------------------------

  const value: AuthContextValue = {
    // Auth state
    user,
    profile,
    session,
    isLoading,
    isAuthenticated: !!user,

    // Restaurant state
    restaurant: {
      currentRestaurant,
      restaurants,
      membership,
      isLoading: restaurantLoading,
    },

    // Auth methods
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
    resetPassword,
    updatePassword,

    // Profile methods
    updateProfile,

    // Restaurant methods
    switchRestaurant,
    refreshRestaurants,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

// ============================================
// HOOK
// ============================================

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// ============================================
// EXPORTS
// ============================================

export { AuthContext }
export type { AuthContextValue, AuthState, RestaurantState, SignUpMetadata, AuthResult }
