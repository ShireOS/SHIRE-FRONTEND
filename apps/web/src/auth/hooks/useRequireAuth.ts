import { useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import type { Restaurant } from '@shire/db'

const getCompletedRestaurant = (
  currentRestaurant: Restaurant | null,
  restaurants: Restaurant[]
): Restaurant | null => {
  if (currentRestaurant?.onboarding_completed_at) {
    return currentRestaurant
  }

  return restaurants.find(restaurant => Boolean(restaurant.onboarding_completed_at)) ?? null
}

const getOnboardingRestaurant = (
  currentRestaurant: Restaurant | null,
  restaurants: Restaurant[]
): Restaurant | null => {
  if (currentRestaurant && !currentRestaurant.onboarding_completed_at) {
    return currentRestaurant
  }

  return restaurants.find(restaurant => !restaurant.onboarding_completed_at) ?? null
}

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
  const completedRestaurant = getCompletedRestaurant(
    auth.restaurant.currentRestaurant,
    auth.restaurant.restaurants
  )
  const resolvedRestaurant = requireOnboarding
    ? completedRestaurant
    : auth.restaurant.currentRestaurant
  const needsRestaurantSwitch = Boolean(
    requireOnboarding &&
    completedRestaurant &&
    auth.restaurant.currentRestaurant?.id !== completedRestaurant.id
  )

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
      if (!completedRestaurant) {
        navigate(onboardingRedirect, { replace: true })
        return
      }

      if (needsRestaurantSwitch) {
        void auth.switchRestaurant(completedRestaurant.id)
      }
    }
  }, [
    auth.isLoading,
    auth.isAuthenticated,
    auth.accountType,
    auth.restaurant.isLoading,
    auth.restaurant.currentRestaurant,
    auth.restaurant.restaurants,
    auth.switchRestaurant,
    completedRestaurant,
    needsRestaurantSwitch,
    navigate,
    location.pathname,
    redirectTo,
    requireOnboarding,
    onboardingRedirect,
  ])

  return {
    /** True when auth state is determined and redirects are complete */
    isReady:
      !auth.isLoading &&
      !auth.restaurant.isLoading &&
      auth.isAuthenticated &&
      (!requireOnboarding || (!!resolvedRestaurant && !needsRestaurantSwitch)),
    /** Current user */
    user: auth.user,
    /** User profile */
    profile: auth.profile,
    /** Current restaurant */
    restaurant: resolvedRestaurant,
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
  const location = useLocation()
  const isSetupEditor = /^\/(?:reseller\/)?restaurants\/[^/]+\/setup\/?$/.test(location.pathname)
  const isNewRestaurantFlow =
    location.pathname === '/onboarding' &&
    new URLSearchParams(location.search).get('new') === '1'
  const onboardingRestaurant = getOnboardingRestaurant(
    auth.restaurant.currentRestaurant,
    auth.restaurant.restaurants
  )
  const completedRestaurant = getCompletedRestaurant(
    auth.restaurant.currentRestaurant,
    auth.restaurant.restaurants
  )

  useEffect(() => {
    // Wait for auth AND restaurant data to initialize
    if (auth.isLoading || auth.restaurant.isLoading) return

    // Not authenticated - redirect to login
    if (!auth.isAuthenticated) {
      navigate('/auth/login', { replace: true })
      return
    }

    if (auth.accountType === 'reseller') {
      navigate('/reseller/onboarding', { replace: true })
      return
    }

    if (auth.accountType === 'reseller_employee') {
      navigate('/reseller', { replace: true })
      return
    }

    if (completedRestaurant && !isSetupEditor && !isNewRestaurantFlow) {
      if (auth.restaurant.currentRestaurant?.id !== completedRestaurant.id) {
        void auth.switchRestaurant(completedRestaurant.id)
      }
      navigate('/restaurants', { replace: true })
      return
    }

    if (onboardingRestaurant && !isNewRestaurantFlow) {
      if (auth.restaurant.currentRestaurant?.id !== onboardingRestaurant.id) {
        void auth.switchRestaurant(onboardingRestaurant.id)
      }
      return
    }
  }, [
    auth.isLoading,
    auth.isAuthenticated,
    auth.accountType,
    auth.restaurant.isLoading,
    auth.restaurant.currentRestaurant,
    auth.restaurant.restaurants,
    auth.switchRestaurant,
    onboardingRestaurant,
    completedRestaurant,
    isSetupEditor,
    isNewRestaurantFlow,
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
      if (auth.accountType === 'reseller') {
        navigate('/reseller/onboarding', { replace: true })
        return
      }

      if (auth.accountType === 'reseller_employee') {
        navigate('/reseller', { replace: true })
        return
      }

      const completedRestaurant = getCompletedRestaurant(
        auth.restaurant.currentRestaurant,
        auth.restaurant.restaurants
      )

      if (!completedRestaurant) {
        navigate('/onboarding', { replace: true })
        return
      }

      if (auth.restaurant.currentRestaurant?.id !== completedRestaurant.id) {
        void auth.switchRestaurant(completedRestaurant.id)
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
    auth.restaurant.restaurants,
    auth.switchRestaurant,
    navigate,
    location.state,
    redirectTo,
  ])

  return {
    isReady: !auth.isLoading && !auth.restaurant.isLoading,
    isAuthenticated: auth.isAuthenticated,
  }
}
