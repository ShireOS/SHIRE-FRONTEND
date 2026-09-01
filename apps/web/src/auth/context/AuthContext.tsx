import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from 'react'
import type { Query } from '@tanstack/react-query'
import { isSupabaseConfigured, supabase, supabaseConfigError } from '../../shared/lib/supabase'
import { queryClient } from '../../shared/query/queryClient'
import { fetchWithSupabaseAuth } from '../../shared/query/fetchWithSupabaseAuth'
import type { User, Session, AuthError } from '@supabase/supabase-js'
import type { Profile, Restaurant, RestaurantMember } from '@shire/db'
import { isAbortError } from '../utils/authErrors'
import { isUnrecoverableSessionError } from '../../shared/auth/sessionErrors'
import { redirectForUnrecoverableSession } from '../../shared/auth/sessionRecovery'
import { createAuthHydrationCoordinator } from './authHydrationCoordinator'
import { createAppAuthUrl } from '../inviteFlow'

const isRestaurantMemberPolicyRecursion = (message: string): boolean =>
  message
    .toLowerCase()
    .includes('infinite recursion detected in policy for relation "restaurant_members"')

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
const AUTH_BOOTSTRAP_GUARD_MS = 12000
const AUTH_REQUEST_TIMEOUT_MS = 10000
const CURRENT_RESTAURANT_STORAGE_KEY = 'shire_current_restaurant'
const AUTH_NOT_CONFIGURED_ERROR =
  supabaseConfigError || '[Supabase] Auth is not configured for this environment.'

const withTimeout = async <T,>(
  operation: PromiseLike<T>,
  timeoutMessage: string,
  timeoutMs = AUTH_REQUEST_TIMEOUT_MS
): Promise<T> => {
  let timerId: ReturnType<typeof setTimeout> | null = null

  const timeoutPromise = new Promise<never>((_, reject) => {
    timerId = setTimeout(() => {
      reject(new Error(timeoutMessage))
    }, timeoutMs)
  })

  try {
    return await Promise.race([Promise.resolve(operation), timeoutPromise])
  } finally {
    if (timerId) clearTimeout(timerId)
  }
}

const withAbortSignal = <T,>(operation: T, signal?: AbortSignal): T => {
  if (!signal) return operation
  return (operation as T & { abortSignal: (requestSignal: AbortSignal) => T }).abortSignal(signal)
}

const throwIfAborted = (signal?: AbortSignal) => {
  if (signal?.aborted) throw new DOMException('Account hydration was superseded.', 'AbortError')
}

const pickRestaurant = (
  availableRestaurants: Restaurant[],
  activeRestaurant: Restaurant | null,
  persistedRestaurantId: string | null
): Restaurant | null => {
  if (availableRestaurants.length === 0) return null

  if (activeRestaurant) {
    const activeMatch = availableRestaurants.find(r => r.id === activeRestaurant.id)
    if (activeMatch?.onboarding_completed_at) return activeMatch
  }

  if (persistedRestaurantId) {
    const savedMatch = availableRestaurants.find(r => r.id === persistedRestaurantId)
    if (savedMatch?.onboarding_completed_at) return savedMatch
  }

  const completedMatch = availableRestaurants.find(restaurant => restaurant.onboarding_completed_at)
  if (completedMatch) return completedMatch

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

type AccountType = 'owner' | 'reseller' | 'reseller_employee' | 'admin'

interface AuthContextValue extends AuthState {
  /** Platform-level role from profiles.account_type; defaults to 'owner'. */
  accountType: AccountType
  restaurant: RestaurantState
  // Auth methods
  signUp: (
    email: string,
    password: string,
    metadata?: SignUpMetadata,
    redirectPath?: string | null,
  ) => Promise<AuthResult>
  signIn: (email: string, password: string) => Promise<AuthResult>
  signInWithGoogle: (redirectPath?: string | null) => Promise<AuthResult>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<AuthResult>
  updatePassword: (newPassword: string) => Promise<AuthResult>
  // Profile methods
  updateProfile: (updates: Partial<Profile>) => Promise<void>
  // Restaurant methods
  switchRestaurant: (restaurantId: string) => Promise<void>
  refreshRestaurants: (preferredRestaurantId?: string | null) => Promise<void>
  seedCurrentRestaurant: (restaurant: Restaurant) => void
}

interface SignUpMetadata {
  first_name?: string
  last_name?: string
  phone?: string
  account_type?: 'owner' | 'reseller'
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
  const [hydratedUserId, setHydratedUserId] = useState<string | null>(null)

  // Restaurant state
  const [currentRestaurant, setCurrentRestaurant] = useState<Restaurant | null>(null)
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [membership, setMembership] = useState<RestaurantMember | null>(null)
  const [restaurantLoading, setRestaurantLoading] = useState(false)

  const initializedRef = useRef(false)
  const membershipQueryDisabledRef = useRef(false)
  const membershipErrorLoggedRef = useRef(false)
  const hydrationCoordinatorRef = useRef(createAuthHydrationCoordinator())
  const authUserIdRef = useRef<string | null>(null)
  const authIdentityResolvedRef = useRef(false)
  const authEventGenerationRef = useRef(0)

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
    hydrationCoordinatorRef.current.invalidate()
    setProfile(null)
    setCurrentRestaurant(null)
    setRestaurants([])
    setMembership(null)
    setRestaurantLoading(false)
    setHydratedUserId(null)
    membershipQueryDisabledRef.current = false
    membershipErrorLoggedRef.current = false
    localStorage.removeItem(CURRENT_RESTAURANT_STORAGE_KEY)
  }, [])

  const applyAuthIdentity = useCallback((nextUserId: string | null) => {
    const identityChanged = (
      authIdentityResolvedRef.current
      && authUserIdRef.current !== nextUserId
    )
    if (identityChanged) {
      // Query keys are restaurant-scoped, not user-scoped. A direct A -> B
      // session replacement must not let B reuse A's cached preferences/data.
      queryClient.clear()
      resetRestaurantState()
    } else if (authUserIdRef.current !== nextUserId) {
      hydrationCoordinatorRef.current.invalidate()
    }
    authIdentityResolvedRef.current = true
    authUserIdRef.current = nextUserId
  }, [resetRestaurantState])

  const fetchMembership = useCallback(async (
    restaurantId: string,
    userId: string
  ): Promise<RestaurantMember | null> => {
    if (!isSupabaseConfigured) return null
    if (membershipQueryDisabledRef.current) return null

    let result
    try {
      result = await withTimeout(
        supabase
          .from('restaurant_members')
          .select('*')
          .eq('restaurant_id', restaurantId)
          .eq('user_id', userId)
          .maybeSingle(),
        'Membership lookup timed out.'
      )
    } catch (error) {
      console.warn('[Auth] Could not fetch membership:', error)
      return null
    }

    const { data: member, error: memberError } = result

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
  const fetchProfile = useCallback(async (
    userId: string,
    signal?: AbortSignal,
  ): Promise<Profile | null> => {
    if (!isSupabaseConfigured) return null
    let result
    try {
      result = await withTimeout(
        withAbortSignal(supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single(), signal),
        'Profile lookup timed out.'
      )
      throwIfAborted(signal)
    } catch (error) {
      if (isAbortError(error)) throw error
      console.warn('[Auth] Could not fetch profile:', error)
      return null
    }

    const { data, error } = result

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
  const fetchRestaurants = useCallback(async (
    userId: string,
    accountType: AccountType = 'owner',
    signal?: AbortSignal,
  ): Promise<Restaurant[]> => {
    if (!isSupabaseConfigured) return []

    try {
      const servicePortfolioRequest = fetchWithSupabaseAuth<Restaurant[]>('/account/restaurants', {
        signal,
        timeoutMs: AUTH_REQUEST_TIMEOUT_MS,
      }).catch((error) => {
        if (isAbortError(error)) throw error
        console.warn('[Auth] Could not fetch canonical restaurant portfolio:', error)
        return []
      })

      if (accountType === 'reseller_employee') {
        const { data: employee, error: employeeError } = await withTimeout(
          withAbortSignal(supabase
            .from('reseller_employees')
            .select('id, reseller_id, status, group_assignments:reseller_employee_groups(group_id)')
            .eq('user_id', userId)
            .eq('status', 'active')
            .maybeSingle(), signal),
          'Reseller employee lookup timed out.'
        )
        throwIfAborted(signal)
        if (employeeError) {
          console.warn('[Auth] Could not fetch reseller employee:', employeeError.message)
          return []
        }
        if (!employee?.id) {
          return []
        }

        const { data: assignments, error: assignmentError } = await withTimeout(
          withAbortSignal(supabase
            .from('reseller_employee_restaurants')
            .select('restaurant:restaurants(*)')
            .eq('employee_id', employee.id), signal),
          'Reseller employee restaurant lookup timed out.'
        )
        throwIfAborted(signal)
        if (assignmentError) {
          console.warn('[Auth] Could not fetch reseller employee restaurants:', assignmentError.message)
          return []
        }

        const directRestaurants = assignments
          ?.map((assignment: any) => assignment.restaurant)
          .filter(Boolean) || []
        const groupIds = new Set(
          ((employee as any).group_assignments || []).map((assignment: any) => assignment.group_id)
        )
        let groupRestaurants: Restaurant[] = []
        if (groupIds.size > 0) {
          const { data: groupAssignments, error: groupAssignmentError } = await withTimeout(
            withAbortSignal(supabase
              .from('reseller_restaurant_group_members')
              .select('restaurant:restaurants(*)')
              .in('group_id', [...groupIds]), signal),
            'Reseller employee group restaurant lookup timed out.'
          )
          throwIfAborted(signal)
          if (groupAssignmentError) {
            console.warn('[Auth] Could not fetch reseller employee group restaurants:', groupAssignmentError.message)
          } else {
            groupRestaurants = groupAssignments
              ?.map((assignment: any) => assignment.restaurant)
              .filter(Boolean) || []
          }
        }

        const serviceRestaurants = await servicePortfolioRequest
        throwIfAborted(signal)
        const scopedRestaurants: Restaurant[] = []
        for (const restaurant of [...directRestaurants, ...groupRestaurants, ...serviceRestaurants]) {
          if (!scopedRestaurants.some((item) => item.id === restaurant.id)) {
            scopedRestaurants.push(restaurant)
          }
        }
        return scopedRestaurants
      }

      // Keep the admin portfolio aligned with the backend's operational scope:
      // closed restaurants are historical and are not authorized for store metrics.
      if (accountType === 'admin') {
        const { data: allRestaurants, error: allError } = await withTimeout(
          withAbortSignal(
            supabase
              .from('restaurants')
              .select('*')
              .neq('status', 'closed')
              .order('name'),
            signal,
          ),
          'Restaurant lookup timed out.'
        )
        throwIfAborted(signal)
        if (allError) {
          console.warn('[Auth] Could not fetch restaurants as admin:', allError.message)
        }
        const serviceRestaurants = await servicePortfolioRequest
        throwIfAborted(signal)
        const resolved = [...(allRestaurants || [])]
        for (const restaurant of serviceRestaurants) {
          if (!resolved.some((item) => item.id === restaurant.id)) resolved.push(restaurant)
        }
        return resolved
      }

      // These scopes are independent once account type is known. Run them
      // together so cold auth hydration pays one network round trip instead of
      // owned -> portfolio -> membership serial latency.
      const ownedRequest = withTimeout(
        withAbortSignal(supabase
          .from('restaurants')
          .select('*')
          .eq('owner_id', userId), signal),
        'Owned restaurant lookup timed out.'
      )
      const portfolioRequest = accountType === 'reseller'
        ? withTimeout(
          withAbortSignal(supabase
            .from('reseller_restaurants')
            .select('restaurant:restaurants(*)')
            .eq('reseller_id', userId)
            .eq('status', 'active'), signal),
          'Reseller portfolio lookup timed out.'
        )
        : Promise.resolve({ data: [], error: null })
      const membershipRequest = !membershipQueryDisabledRef.current
        ? withTimeout(
          withAbortSignal(supabase
            .from('restaurant_members')
            .select(`
              *,
              restaurant:restaurants(*)
            `)
            .eq('user_id', userId)
            .eq('status', 'active'), signal),
          'Member restaurant lookup timed out.'
        )
        : Promise.resolve({ data: [], error: null })
      const [
        { data: ownedRestaurants, error: ownedError },
        { data: assignments, error: portfolioError },
        { data: memberships, error: memberError },
        serviceRestaurants,
      ] = await Promise.all([
        ownedRequest,
        portfolioRequest,
        membershipRequest,
        servicePortfolioRequest,
      ])
      throwIfAborted(signal)

      if (ownedError) {
        console.warn('[Auth] Could not fetch owned restaurants:', ownedError.message)
      }

      // Resellers additionally see their assigned portfolio.
      let portfolioRestaurants: Restaurant[] = []
      if (portfolioError) {
        console.warn('[Auth] Could not fetch reseller portfolio:', portfolioError.message)
      } else {
        portfolioRestaurants = assignments
          ?.map((a: any) => a.restaurant)
          .filter(Boolean) || []
      }

      let memberRestaurants: Restaurant[] = []
      if (memberError) {
        handleMembershipError(memberError.message, 'Could not fetch memberships (RLS may need setup)')
      } else {
        memberRestaurants = memberships
          ?.map((m: any) => m.restaurant)
          .filter(Boolean) || []
      }

      // Combine owned, member, and portfolio restaurants (dedupe)
      const allRestaurants = [...(ownedRestaurants || [])]

      for (const restaurant of [...memberRestaurants, ...portfolioRestaurants, ...serviceRestaurants]) {
        if (!allRestaurants.some(owned => owned.id === restaurant.id)) {
          allRestaurants.push(restaurant)
        }
      }

      return allRestaurants
    } catch (error) {
      if (isAbortError(error)) throw error
      console.error('[Auth] Error in fetchRestaurants:', error)
      return []
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

  const seedCurrentRestaurant = useCallback((restaurant: Restaurant) => {
    setRestaurants(prev => {
      const withoutMatch = prev.filter(existing => existing.id !== restaurant.id)
      return [...withoutMatch, restaurant]
    })
    setCurrentRestaurant(restaurant)
    localStorage.setItem(CURRENT_RESTAURANT_STORAGE_KEY, restaurant.id)
  }, [])

  // ----------------------------------------
  // REFRESH RESTAURANTS
  // ----------------------------------------
  const refreshRestaurants = useCallback(async (preferredRestaurantId?: string | null) => {
    if (!user) return
    const hydration = hydrationCoordinatorRef.current.begin()
    setRestaurantLoading(true)

    try {
      const userRestaurants = await fetchRestaurants(
        user.id,
        (profile?.account_type as AccountType) || 'owner',
        hydration.signal,
      )
      if (!hydration.isCurrent()) return
      setRestaurants(userRestaurants)

      if (userRestaurants.length === 0) {
        if (preferredRestaurantId && currentRestaurant?.id === preferredRestaurantId) {
          localStorage.setItem(CURRENT_RESTAURANT_STORAGE_KEY, preferredRestaurantId)
          return
        }
        setCurrentRestaurant(null)
        setMembership(null)
        localStorage.removeItem(CURRENT_RESTAURANT_STORAGE_KEY)
        return
      }

      const savedRestaurantId = localStorage.getItem(CURRENT_RESTAURANT_STORAGE_KEY)
      const preferredRestaurant =
        preferredRestaurantId
          ? userRestaurants.find((restaurant) => restaurant.id === preferredRestaurantId) ?? null
          : null
      const restaurantToSelect =
        preferredRestaurant
        ?? pickRestaurant(userRestaurants, currentRestaurant, savedRestaurantId)

      if (restaurantToSelect) {
        setCurrentRestaurant(restaurantToSelect)
        localStorage.setItem(CURRENT_RESTAURANT_STORAGE_KEY, restaurantToSelect.id)
      }
    } catch (error) {
      if (!isAbortError(error) && hydration.isCurrent()) {
        console.error('[Auth] Could not refresh restaurants:', error)
        setRestaurants([])
      }
    } finally {
      if (hydration.isCurrent()) {
        setRestaurantLoading(false)
        setHydratedUserId(user.id)
      }
    }
  }, [user, profile?.account_type, fetchRestaurants, currentRestaurant])

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
      const initializationGeneration = authEventGenerationRef.current
      try {
        const currentSession = await getSessionWithRetry()

        if (!mounted || authEventGenerationRef.current !== initializationGeneration) return

        const nextUserId = currentSession?.user.id ?? null
        applyAuthIdentity(nextUserId)
        setSession(currentSession)
        setUser(currentSession?.user ?? null)
      } catch (error) {
        if (isUnrecoverableSessionError(error as AuthError)) {
          await redirectForUnrecoverableSession()
        } else if (isAbortError(error)) {
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

      authEventGenerationRef.current += 1
      console.log('[Auth] State change:', event)

      const nextUserId = nextSession?.user.id ?? null
      applyAuthIdentity(nextUserId)
      setIsLoading(false)
      initializedRef.current = true

      if (event === 'SIGNED_OUT') {
        queryClient.clear()
        setSession(null)
        setUser(null)
        resetRestaurantState()
        return
      }

      if (event === 'TOKEN_REFRESHED') {
        void queryClient.invalidateQueries({
          predicate: (query: Query) => query.state.status === 'error',
        })
      }

      setSession(nextSession ?? null)
      setUser(nextSession?.user ?? null)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [applyAuthIdentity, getSessionWithRetry, resetRestaurantState])

  // Hydrate user-dependent data outside auth state-change callback.
  useEffect(() => {
    const hydration = hydrationCoordinatorRef.current.begin()
    const userId = user?.id ?? null

    if (!userId) {
      setProfile(null)
      setCurrentRestaurant(null)
      setRestaurants([])
      setMembership(null)
      setRestaurantLoading(false)
      setHydratedUserId(null)
      return hydration.cancel
    }

    setHydratedUserId(null)
    setRestaurantLoading(true)

    const hydrateUserState = async () => {
      try {
        const userProfile = await fetchProfile(userId, hydration.signal)
        if (!hydration.isCurrent()) return
        setProfile(userProfile)

        const userRestaurants = await fetchRestaurants(
          userId,
          (userProfile?.account_type as AccountType) || 'owner',
          hydration.signal,
        )
        if (!hydration.isCurrent()) return
        setRestaurants(userRestaurants)

        const savedRestaurantId = localStorage.getItem(CURRENT_RESTAURANT_STORAGE_KEY)
        const restaurantToSelect = pickRestaurant(userRestaurants, null, savedRestaurantId)

        setCurrentRestaurant(restaurantToSelect)

        if (restaurantToSelect) {
          localStorage.setItem(CURRENT_RESTAURANT_STORAGE_KEY, restaurantToSelect.id)
        } else {
          localStorage.removeItem(CURRENT_RESTAURANT_STORAGE_KEY)
        }
      } catch (error) {
        if (!isAbortError(error) && hydration.isCurrent()) {
          console.error('[Auth] Could not hydrate account state:', error)
          setRestaurants([])
          setCurrentRestaurant(null)
        }
      } finally {
        if (hydration.isCurrent()) {
          setRestaurantLoading(false)
          setHydratedUserId(userId)
        }
      }
    }

    void hydrateUserState()

    return hydration.cancel
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
      setHydratedUserId(user?.id ?? null)
    }, AUTH_BOOTSTRAP_GUARD_MS)

    return () => {
      clearTimeout(timer)
    }
  }, [isLoading, restaurantLoading, user?.id])

  // ----------------------------------------
  // AUTH METHODS
  // ----------------------------------------

  const signUp = async (
    email: string,
    password: string,
    metadata?: SignUpMetadata,
    redirectPath?: string | null,
  ): Promise<AuthResult> => {
    if (!isSupabaseConfigured) {
      return { success: false, error: AUTH_NOT_CONFIGURED_ERROR }
    }

    try {
      const { data, error } = await withTimeout(
        supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              first_name: metadata?.first_name,
              last_name: metadata?.last_name,
              phone: metadata?.phone,
              account_type: metadata?.account_type || 'owner',
            },
            emailRedirectTo: createAppAuthUrl(window.location.origin, 'callback', redirectPath),
          },
        }),
        'Sign up timed out. Please check your connection and try again.'
      )

      if (error) throw error

      if (data.session) {
        applyAuthIdentity(data.session.user.id)
        setSession(data.session)
        setUser(data.session.user)
        setHydratedUserId(null)
      }

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
      let credentialEmail = email.trim()
      const { data: resolvedLogin } = await supabase.rpc('resolve_reseller_employee_login', {
        login_identifier: credentialEmail,
      })
      if (typeof resolvedLogin === 'string' && resolvedLogin.length > 0) {
        credentialEmail = resolvedLogin
      }

      const { data, error } = await withTimeout(
        supabase.auth.signInWithPassword({
          email: credentialEmail,
          password,
        }),
        'Sign in timed out. Please check your connection and try again.'
      )

      if (error) throw error

      if (data.session) {
        applyAuthIdentity(data.session.user.id)
        setSession(data.session)
        setUser(data.session.user)
        setHydratedUserId(null)
      }

      return { success: true }
    } catch (error) {
      const authError = error as AuthError
      return { success: false, error: authError.message }
    }
  }

  const signInWithGoogle = async (redirectPath?: string | null): Promise<AuthResult> => {
    if (!isSupabaseConfigured) {
      return { success: false, error: AUTH_NOT_CONFIGURED_ERROR }
    }

    try {
      const { error } = await withTimeout(
        supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: createAppAuthUrl(window.location.origin, 'callback', redirectPath),
          },
        }),
        'Google sign in timed out. Please check your connection and try again.'
      )

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
      const { error } = await withTimeout(
        supabase.auth.resetPasswordForEmail(email, {
          redirectTo: createAppAuthUrl(window.location.origin, 'reset-password'),
        }),
        'Password reset timed out. Please check your connection and try again.'
      )

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
      const { error } = await withTimeout(
        supabase.auth.updateUser({
          password: newPassword,
        }),
        'Password update timed out. Please check your connection and try again.'
      )

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
    accountType: (profile?.account_type as AccountType) || 'owner',

    // Restaurant state
    restaurant: {
      currentRestaurant,
      restaurants,
      membership,
      isLoading: restaurantLoading || Boolean(user && hydratedUserId !== user.id),
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
    seedCurrentRestaurant,
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
