import { useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

interface UseRequireAuthOptions {
  /** Redirect to this path if not authenticated (default: /auth/login) */
  redirectTo?: string
  /** If true, also require onboarding to be complete (default: false) */
  requireOnboarding?: boolean
  /** Redirect here if onboarding is not complete (default: /onboarding) */
  onboardingRedirect?: string
}

/**
 * Hook to protect routes that require authentication
 *
 * Usage:
 * ```tsx
 * function ProtectedPage() {
 *   const { isReady, user, restaurant } = useRequireAuth()
 *
 *   if (!isReady) return <LoadingSpinner />
 *
 *   return <div>Welcome {user.email}</div>
 * }
 * ```
 */
export function useRequireAuth(options: UseRequireAuthOptions = {}) {
  const {
    redirectTo = '/auth/login',
    requireOnboarding = true,
    onboardingRedirect = '/onboarding',
  } = options

  const auth = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    // Wait for auth AND restaurant data to initialize
    if (auth.isLoading || auth.restaurant.isLoading) return

    // Not authenticated - redirect to login
    if (!auth.isAuthenticated) {
      navigate(redirectTo, {
        replace: true,
        state: { from: location.pathname },
      })
      return
    }

    // Check onboarding status if required
    if (requireOnboarding) {
      const restaurant = auth.restaurant.currentRestaurant

      // If NO restaurant exists OR onboarding not complete, redirect to onboarding
      if (!restaurant || !restaurant.onboarding_completed_at) {
        navigate(onboardingRedirect, { replace: true })
        return
      }
    }
  }, [
    auth.isLoading,
    auth.isAuthenticated,
    auth.restaurant.isLoading,
    auth.restaurant.currentRestaurant,
    navigate,
    location.pathname,
    redirectTo,
    requireOnboarding,
    onboardingRedirect,
  ])

  return {
    /** True when auth state is determined and redirects are complete */
    isReady: !auth.isLoading && !auth.restaurant.isLoading && auth.isAuthenticated,
    /** Current user */
    user: auth.user,
    /** User profile */
    profile: auth.profile,
    /** Current restaurant */
    restaurant: auth.restaurant.currentRestaurant,
    /** User's role/membership in current restaurant */
    membership: auth.restaurant.membership,
    /** All restaurants user has access to */
    restaurants: auth.restaurant.restaurants,
    /** Full auth context */
    auth,
  }
}

/**
 * Hook for onboarding pages - requires auth but NOT completed onboarding
 */
export function useRequireOnboarding() {
  const auth = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    // Wait for auth AND restaurant data to initialize
    if (auth.isLoading || auth.restaurant.isLoading) return

    // Not authenticated - redirect to login
    if (!auth.isAuthenticated) {
      navigate('/auth/login', { replace: true })
      return
    }

    // DEV: redirect disabled so /dev-onboarding works without resetting DB each time
    // if (auth.restaurant.currentRestaurant?.onboarding_completed_at) {
    //   navigate('/', { replace: true })
    //   return
    // }

    //ABOVE, PLS UNCOMMENT AFTER DEV HARSHITH

    // Otherwise stay here - user needs onboarding (no restaurant or incomplete)
  }, [
    auth.isLoading,
    auth.isAuthenticated,
    auth.restaurant.isLoading,
    auth.restaurant.currentRestaurant,
    navigate,
  ])

  return {
    isReady: !auth.isLoading && !auth.restaurant.isLoading && auth.isAuthenticated,
    user: auth.user,
    profile: auth.profile,
    restaurant: auth.restaurant.currentRestaurant,
    auth,
  }
}

/**
 * Hook for public pages (login, signup) - redirect away if already logged in
 */
export function useRedirectIfAuthenticated(redirectTo = '/') {
  const auth = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    // Wait for auth AND restaurant data to initialize
    if (auth.isLoading || auth.restaurant.isLoading) return

    if (auth.isAuthenticated) {
      // Check if we should redirect to onboarding
      // Redirect to onboarding if: NO restaurant OR restaurant exists but onboarding not complete
      const restaurant = auth.restaurant.currentRestaurant
      if (!restaurant || !restaurant.onboarding_completed_at) {
        navigate('/onboarding', { replace: true })
        return
      }

      // Redirect to intended destination or default
      const from = (location.state as any)?.from || redirectTo
      navigate(from, { replace: true })
    }
  }, [
    auth.isLoading,
    auth.isAuthenticated,
    auth.restaurant.isLoading,
    auth.restaurant.currentRestaurant,
    navigate,
    location.state,
    redirectTo,
  ])

  return {
    isReady: !auth.isLoading && !auth.restaurant.isLoading,
    isAuthenticated: auth.isAuthenticated,
  }
}
