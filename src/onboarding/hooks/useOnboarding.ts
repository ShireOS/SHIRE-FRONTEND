import { useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../shared/lib/supabase'
import { useAuth } from '../../auth'
import type { Restaurant, RestaurantType } from '../../shared/types/database'

// ============================================
// TYPES
// ============================================

export interface OnboardingData {
  // Step 0: Basics
  name: string
  address: string
  city: string
  state: string
  postal_code: string
  country: string
  timezone: string
  type: RestaurantType | null
  cuisine_types: string[]
  phone: string

  // Step 1: Goals & Priorities
  challenges: string[]
  daily_covers_range: string | null
  team_size_range: string | null
  primary_goal: string | null

  // Step 3: Current Tools
  current_pos: string | null
  current_scheduling: string | null
  current_reservations: string | null

  // Step 4: Hours
  operating_hours: OperatingHoursData[]
  same_hours_every_day: boolean

  // Step 5: Capacity
  seating_capacity: number | null
  table_count: number | null
  sections: string[]

  // Step 6: Menu
  menu_import_method: 'skip' | 'manual' | 'upload' | 'toast' | 'scrape' | 'template'

  // Step 7: Team
  team_setup_method: 'skip' | 'invite' | 'sevenshifts'
  invites: TeamInvite[]
}

export interface OperatingHoursData {
  day_of_week: number
  open_time: string
  close_time: string
  is_closed: boolean
}

export interface TeamInvite {
  email: string
  role: 'manager' | 'server' | 'host' | 'kitchen'
}

interface OnboardingDraft {
  version: number
  currentStep: number
  restaurantId: string | null
  data: Partial<OnboardingData>
  updatedAt: string
}

const DEFAULT_HOURS: OperatingHoursData[] = [
  { day_of_week: 0, open_time: '11:00', close_time: '22:00', is_closed: true }, // Sunday
  { day_of_week: 1, open_time: '11:00', close_time: '22:00', is_closed: false },
  { day_of_week: 2, open_time: '11:00', close_time: '22:00', is_closed: false },
  { day_of_week: 3, open_time: '11:00', close_time: '22:00', is_closed: false },
  { day_of_week: 4, open_time: '11:00', close_time: '22:00', is_closed: false },
  { day_of_week: 5, open_time: '11:00', close_time: '23:00', is_closed: false },
  { day_of_week: 6, open_time: '11:00', close_time: '23:00', is_closed: false },
]

const INITIAL_DATA: OnboardingData = {
  name: '',
  address: '',
  city: '',
  state: '',
  postal_code: '',
  country: 'US',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  type: null,
  cuisine_types: [],
  phone: '',

  challenges: [],
  daily_covers_range: null,
  team_size_range: null,
  primary_goal: null,

  current_pos: null,
  current_scheduling: null,
  current_reservations: null,

  operating_hours: DEFAULT_HOURS,
  same_hours_every_day: true,

  seating_capacity: null,
  table_count: null,
  sections: ['Main Floor', 'Bar', 'Patio'],

  menu_import_method: 'skip',

  team_setup_method: 'skip',
  invites: [],
}

const ONBOARDING_MAX_STEP = 7
const REQUEST_TIMEOUT_MS = 20000
const ONBOARDING_DRAFT_VERSION = 1

const MENU_IMPORT_METHODS: OnboardingData['menu_import_method'][] = [
  'skip',
  'manual',
  'upload',
  'toast',
  'scrape',
  'template',
]

const TEAM_SETUP_METHODS: OnboardingData['team_setup_method'][] = [
  'skip',
  'invite',
  'sevenshifts',
]

const TEAM_ROLES: TeamInvite['role'][] = ['manager', 'server', 'host', 'kitchen']

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const asString = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback

const asNullableString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

const asNullableNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null

const asStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === 'string')
    .map(item => item.trim())
    .filter(Boolean)
}

const asMenuImportMethod = (value: unknown): OnboardingData['menu_import_method'] =>
  MENU_IMPORT_METHODS.includes(value as OnboardingData['menu_import_method'])
    ? (value as OnboardingData['menu_import_method'])
    : INITIAL_DATA.menu_import_method

const asTeamSetupMethod = (value: unknown): OnboardingData['team_setup_method'] =>
  TEAM_SETUP_METHODS.includes(value as OnboardingData['team_setup_method'])
    ? (value as OnboardingData['team_setup_method'])
    : INITIAL_DATA.team_setup_method

const asInvites = (value: unknown): TeamInvite[] => {
  if (!Array.isArray(value)) return []

  return value
    .filter(isRecord)
    .map((invite) => {
      const email = asString(invite.email).trim()
      const role = invite.role

      if (!email || !TEAM_ROLES.includes(role as TeamInvite['role'])) {
        return null
      }

      return { email, role: role as TeamInvite['role'] }
    })
    .filter((invite): invite is TeamInvite => invite !== null)
}

const normalizeTime = (value: unknown, fallback: string): string => {
  if (typeof value !== 'string') return fallback
  return value.slice(0, 5)
}

const normalizeOperatingHours = (value: unknown): OperatingHoursData[] => {
  const seeded = DEFAULT_HOURS.map(hours => ({ ...hours }))
  if (!Array.isArray(value)) return seeded

  for (const row of value) {
    if (!isRecord(row)) continue

    const dayOfWeek = Number(row.day_of_week)
    if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) continue

    const fallback = seeded[dayOfWeek]
    seeded[dayOfWeek] = {
      day_of_week: dayOfWeek,
      open_time: normalizeTime(row.open_time, fallback.open_time),
      close_time: normalizeTime(row.close_time, fallback.close_time),
      is_closed: typeof row.is_closed === 'boolean' ? row.is_closed : fallback.is_closed,
    }
  }

  return seeded
}

const toOnboardingData = (value: Partial<OnboardingData> | null | undefined): OnboardingData => {
  const input = value ?? {}
  const sections = asStringArray(input.sections)

  return {
    name: asString(input.name),
    address: asString(input.address),
    city: asString(input.city),
    state: asString(input.state),
    postal_code: asString(input.postal_code),
    country: asString(input.country, INITIAL_DATA.country),
    timezone: asString(input.timezone, INITIAL_DATA.timezone),
    type: input.type ?? INITIAL_DATA.type,
    cuisine_types: asStringArray(input.cuisine_types),
    phone: asString(input.phone),
    challenges: asStringArray(input.challenges),
    daily_covers_range: asNullableString(input.daily_covers_range),
    team_size_range: asNullableString(input.team_size_range),
    primary_goal: asNullableString(input.primary_goal),
    current_pos: asNullableString(input.current_pos),
    current_scheduling: asNullableString(input.current_scheduling),
    current_reservations: asNullableString(input.current_reservations),
    operating_hours: normalizeOperatingHours(input.operating_hours),
    same_hours_every_day:
      typeof input.same_hours_every_day === 'boolean'
        ? input.same_hours_every_day
        : INITIAL_DATA.same_hours_every_day,
    seating_capacity: asNullableNumber(input.seating_capacity),
    table_count: asNullableNumber(input.table_count),
    sections: sections.length > 0 ? sections : INITIAL_DATA.sections,
    menu_import_method: asMenuImportMethod(input.menu_import_method),
    team_setup_method: asTeamSetupMethod(input.team_setup_method),
    invites: asInvites(input.invites),
  }
}

const mergeOnboardingData = (base: OnboardingData, updates: Partial<OnboardingData>): OnboardingData =>
  toOnboardingData({ ...base, ...updates })

const clampStep = (step: number): number =>
  Math.max(0, Math.min(step, ONBOARDING_MAX_STEP))

const mapDbStepToUiStep = (step: number | null | undefined): number => clampStep(step ?? 0)

const getDraftStorageKey = (userId: string): string => `shire_onboarding_draft:${userId}`

const readDraft = (userId: string): OnboardingDraft | null => {
  try {
    const raw = localStorage.getItem(getDraftStorageKey(userId))
    if (!raw) return null

    const parsed = JSON.parse(raw) as Partial<OnboardingDraft>
    if (parsed.version !== ONBOARDING_DRAFT_VERSION) return null

    return {
      version: ONBOARDING_DRAFT_VERSION,
      currentStep: clampStep(typeof parsed.currentStep === 'number' ? parsed.currentStep : 0),
      restaurantId: typeof parsed.restaurantId === 'string' ? parsed.restaurantId : null,
      data: isRecord(parsed.data) ? parsed.data as Partial<OnboardingData> : {},
      updatedAt: asString(parsed.updatedAt, new Date(0).toISOString()),
    }
  } catch {
    return null
  }
}

const writeDraft = (userId: string, draft: OnboardingDraft) => {
  try {
    localStorage.setItem(getDraftStorageKey(userId), JSON.stringify(draft))
  } catch (err) {
    console.warn('[Onboarding] Could not persist onboarding draft:', err)
  }
}

const clearDraft = (userId: string) => {
  try {
    localStorage.removeItem(getDraftStorageKey(userId))
  } catch (err) {
    console.warn('[Onboarding] Could not clear onboarding draft:', err)
  }
}

const parseConfig = (value: unknown): Partial<OnboardingData> => {
  if (!isRecord(value)) return {}

  return {
    challenges: asStringArray(value.challenges),
    daily_covers_range: asNullableString(value.daily_covers_range),
    team_size_range: asNullableString(value.team_size_range),
    primary_goal: asNullableString(value.primary_goal),
    current_pos: asNullableString(value.current_pos),
    current_scheduling: asNullableString(value.current_scheduling),
    current_reservations: asNullableString(value.current_reservations),
    menu_import_method: asMenuImportMethod(value.menu_import_method),
    team_setup_method: asTeamSetupMethod(value.team_setup_method),
    invites: asInvites(value.invites),
  }
}

const slugify = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    || 'restaurant'

const buildUniqueSlug = (name: string): string => {
  const randomSuffix =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10)

  return `${slugify(name)}-${randomSuffix}`
}

const isSlugConflict = (error: unknown): boolean => {
  if (!isRecord(error)) return false
  const code = asString(error.code).trim()
  const message = asString(error.message).toLowerCase()

  return code === '23505' && message.includes('slug')
}

const toErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback

// ============================================
// HOOK
// ============================================

export function useOnboarding() {
  const auth = useAuth()
  const { user, refreshRestaurants } = auth
  const currentRestaurant = auth.restaurant.currentRestaurant
  const navigate = useNavigate()

  const [currentStep, setCurrentStep] = useState(0)
  const [data, setData] = useState<OnboardingData>(toOnboardingData(INITIAL_DATA))
  const [restaurantId, setRestaurantId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showLaunchScreen, setShowLaunchScreen] = useState(false)
  const [isHydrating, setIsHydrating] = useState(true)

  const getActiveRestaurantId = useCallback((): string => {
    const activeRestaurantId = restaurantId || currentRestaurant?.id
    if (!activeRestaurantId) {
      throw new Error('No restaurant created')
    }
    return activeRestaurantId
  }, [restaurantId, currentRestaurant?.id])

  const runWithTimeout = useCallback(async <T,>(
    operation: () => PromiseLike<T>,
    timeoutMessage: string
  ): Promise<T> => {
    let timerId: ReturnType<typeof setTimeout> | null = null

    const timeoutPromise = new Promise<never>((_, reject) => {
      timerId = setTimeout(() => {
        reject(new Error(timeoutMessage))
      }, REQUEST_TIMEOUT_MS)
    })

    try {
      return await Promise.race([Promise.resolve(operation()), timeoutPromise])
    } finally {
      if (timerId) clearTimeout(timerId)
    }
  }, [])

  const hydrateFromRestaurant = useCallback(async (restaurant: Restaurant): Promise<Partial<OnboardingData>> => {
    const [hoursResult, sectionsResult] = await Promise.all([
      runWithTimeout(
        () =>
          supabase
            .from('operating_hours')
            .select('day_of_week, open_time, close_time, is_closed')
            .eq('restaurant_id', restaurant.id),
        'Loading operating hours timed out.'
      ),
      runWithTimeout(
        () =>
          supabase
            .from('sections')
            .select('name')
            .eq('restaurant_id', restaurant.id)
            .eq('is_active', true),
        'Loading sections timed out.'
      ),
    ])

    if (hoursResult.error) {
      console.warn('[Onboarding] Could not hydrate operating hours:', hoursResult.error.message)
    }
    if (sectionsResult.error) {
      console.warn('[Onboarding] Could not hydrate sections:', sectionsResult.error.message)
    }

    const sectionNames = asStringArray((sectionsResult.data || []).map(section => section.name))
    const configData = parseConfig(restaurant.config)

    return {
      name: asString(restaurant.name),
      address: asString(restaurant.address),
      city: asString(restaurant.city),
      state: asString(restaurant.state),
      postal_code: asString(restaurant.postal_code),
      country: asString(restaurant.country, INITIAL_DATA.country),
      timezone: asString(restaurant.timezone, INITIAL_DATA.timezone),
      type: restaurant.type,
      cuisine_types: Array.isArray(restaurant.cuisine_types) ? restaurant.cuisine_types : [],
      phone: asString(restaurant.phone),
      seating_capacity: restaurant.seating_capacity,
      table_count: restaurant.table_count,
      operating_hours: normalizeOperatingHours(hoursResult.data),
      sections: sectionNames.length > 0 ? sectionNames : INITIAL_DATA.sections,
      ...configData,
    }
  }, [runWithTimeout])

  const fetchRestaurantConfig = useCallback(async (activeRestaurantId: string): Promise<Record<string, unknown>> => {
    const { data: restaurantRow, error: fetchError } = await runWithTimeout(
      () =>
        supabase
          .from('restaurants')
          .select('config')
          .eq('id', activeRestaurantId)
          .single(),
      'Loading current onboarding settings timed out. Please retry.'
    )

    if (fetchError) throw fetchError

    if (isRecord(restaurantRow?.config)) {
      return restaurantRow.config
    }

    return {}
  }, [runWithTimeout])

  // Hydrate local onboarding state from Supabase + local draft.
  useEffect(() => {
    let cancelled = false

    const hydrate = async () => {
      if (!user) {
        if (!cancelled) {
          setData(toOnboardingData(INITIAL_DATA))
          setCurrentStep(0)
          setRestaurantId(null)
          setIsHydrating(false)
        }
        return
      }

      setIsHydrating(true)

      let mergedData = toOnboardingData(INITIAL_DATA)
      let resolvedRestaurantId: string | null = null
      let resolvedStep = 0

      const localDraft = readDraft(user.id)
      if (localDraft) {
        mergedData = mergeOnboardingData(mergedData, localDraft.data)
        resolvedRestaurantId = localDraft.restaurantId
        resolvedStep = localDraft.currentStep
      }

      const onboardingRestaurant =
        currentRestaurant && !currentRestaurant.onboarding_completed_at
          ? currentRestaurant
          : null

      if (onboardingRestaurant) {
        const restaurantData = await hydrateFromRestaurant(onboardingRestaurant)
        mergedData = mergeOnboardingData(mergedData, restaurantData)
        resolvedRestaurantId = onboardingRestaurant.id
        resolvedStep = Math.max(
          resolvedStep,
          mapDbStepToUiStep(onboardingRestaurant.onboarding_step)
        )
      }

      if (!cancelled) {
        setData(mergedData)
        setRestaurantId(resolvedRestaurantId)
        setCurrentStep(resolvedStep)
        setError(null)
        setIsHydrating(false)
      }
    }

    void hydrate()

    return () => {
      cancelled = true
    }
  }, [
    user?.id,
    currentRestaurant?.id,
    currentRestaurant?.onboarding_step,
    currentRestaurant?.updated_at,
    currentRestaurant?.onboarding_completed_at,
    hydrateFromRestaurant,
  ])

  // Persist in-progress onboarding draft for refresh resilience.
  useEffect(() => {
    if (!user || isHydrating) return

    writeDraft(user.id, {
      version: ONBOARDING_DRAFT_VERSION,
      currentStep: clampStep(currentStep),
      restaurantId,
      data,
      updatedAt: new Date().toISOString(),
    })
  }, [user?.id, isHydrating, currentStep, restaurantId, data])

  // Update data
  const updateData = useCallback((updates: Partial<OnboardingData>) => {
    setData(prev => mergeOnboardingData(prev, updates))
  }, [])

  // Navigate steps (8 steps: 0-7)
  const nextStep = useCallback(() => {
    setCurrentStep(prev => clampStep(prev + 1))
  }, [])

  const prevStep = useCallback(() => {
    setCurrentStep(prev => clampStep(prev - 1))
  }, [])

  const goToStep = useCallback((step: number) => {
    setCurrentStep(clampStep(step))
  }, [])

  // Persist visible step so onboarding resumes across browsers, not just localStorage.
  useEffect(() => {
    const activeRestaurantId = restaurantId || currentRestaurant?.id
    if (!activeRestaurantId) return
    if (isHydrating || showLaunchScreen) return
    if (currentRestaurant?.onboarding_completed_at) return

    const step = clampStep(currentStep)

    void supabase
      .from('restaurants')
      .update({ onboarding_step: step })
      .eq('id', activeRestaurantId)
      .then(({ error: stepError }) => {
        if (stepError) {
          console.warn('[Onboarding] Could not persist onboarding step:', stepError.message)
        }
      })
  }, [
    currentStep,
    restaurantId,
    currentRestaurant?.id,
    currentRestaurant?.onboarding_completed_at,
    isHydrating,
    showLaunchScreen,
  ])

  // Create restaurant (after step 0)
  const createRestaurant = useCallback(async () => {
    if (!user) throw new Error('Not authenticated')

    setIsLoading(true)
    setError(null)

    try {
      const basePayload = {
        owner_id: user.id,
        name: data.name.trim(),
        address: data.address.trim(),
        city: data.city.trim(),
        state: data.state.trim(),
        postal_code: data.postal_code.trim(),
        country: data.country,
        timezone: data.timezone,
        type: data.type,
        cuisine_types: data.cuisine_types,
        phone: data.phone.trim(),
        status: 'onboarding' as const,
        onboarding_step: 1,
      }

      // If a restaurant already exists, update instead of creating a duplicate.
      const existingRestaurantId = restaurantId || currentRestaurant?.id || null
      if (existingRestaurantId) {
        const { data: updatedRestaurant, error: updateError } = await runWithTimeout(
          () =>
            supabase
              .from('restaurants')
              .update(basePayload)
              .eq('id', existingRestaurantId)
              .select()
              .single(),
          'Saving restaurant basics timed out. Please retry.'
        )

        if (updateError) throw updateError

        setRestaurantId(updatedRestaurant.id)
        return updatedRestaurant
      }

      let createdRestaurant: Restaurant | null = null
      let lastCreateError: unknown = null

      for (let attempt = 0; attempt < 3; attempt += 1) {
        const { data: restaurant, error: createError } = await runWithTimeout(
          () =>
            supabase
              .from('restaurants')
              .insert({
                ...basePayload,
                slug: buildUniqueSlug(data.name),
              })
              .select()
              .single(),
          'Creating restaurant timed out. Please retry.'
        )

        if (!createError && restaurant) {
          createdRestaurant = restaurant
          break
        }

        lastCreateError = createError
        if (!isSlugConflict(createError)) {
          throw createError
        }
      }

      if (!createdRestaurant) {
        throw lastCreateError || new Error('Failed to create restaurant')
      }

      // Try to create owner membership — soft fail.
      // owner_id on restaurants is the source of truth for onboarding.
      try {
        const { error: memberError } = await runWithTimeout(
          () =>
            supabase
              .from('restaurant_members')
              .insert({
                restaurant_id: createdRestaurant.id,
                user_id: user.id,
                role: 'owner',
                status: 'active',
                accepted_at: new Date().toISOString(),
              }),
          'Creating owner membership timed out.'
        )

        if (memberError && memberError.code !== '23505') {
          console.warn('[Onboarding] Could not create membership:', memberError.message)
        }
      } catch (membershipError) {
        console.warn('[Onboarding] Could not create membership:', membershipError)
      }

      setRestaurantId(createdRestaurant.id)
      return createdRestaurant
    } catch (err) {
      const message = toErrorMessage(err, 'Failed to create restaurant')
      setError(message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [user, data, restaurantId, currentRestaurant?.id, runWithTimeout])

  // Save goals & priorities (after step 1)
  const saveGoals = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const activeRestaurantId = getActiveRestaurantId()
      const existingConfig = await fetchRestaurantConfig(activeRestaurantId)

      const { error: updateError } = await runWithTimeout(
        () =>
          supabase
            .from('restaurants')
            .update({
              config: {
                ...existingConfig,
                challenges: data.challenges,
                daily_covers_range: data.daily_covers_range,
                team_size_range: data.team_size_range,
                primary_goal: data.primary_goal,
              },
              onboarding_step: 2,
            })
            .eq('id', activeRestaurantId),
        'Saving goals timed out. Please retry.'
      )

      if (updateError) throw updateError

      setRestaurantId(activeRestaurantId)
    } catch (err) {
      const message = toErrorMessage(err, 'Failed to save goals')
      setError(message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [data, getActiveRestaurantId, fetchRestaurantConfig, runWithTimeout])

  // Save tech stack (after step 3)
  const saveTechStack = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const activeRestaurantId = getActiveRestaurantId()
      const existingConfig = await fetchRestaurantConfig(activeRestaurantId)

      const { error: updateError } = await runWithTimeout(
        () =>
          supabase
            .from('restaurants')
            .update({
              config: {
                ...existingConfig,
                current_pos: data.current_pos,
                current_scheduling: data.current_scheduling,
                current_reservations: data.current_reservations,
              },
              onboarding_step: 4,
            })
            .eq('id', activeRestaurantId),
        'Saving current tools timed out. Please retry.'
      )

      if (updateError) throw updateError

      setRestaurantId(activeRestaurantId)
    } catch (err) {
      const message = toErrorMessage(err, 'Failed to save tech stack')
      setError(message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [data, getActiveRestaurantId, fetchRestaurantConfig, runWithTimeout])

  // Save operating hours (after step 4)
  const saveOperatingHours = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const activeRestaurantId = getActiveRestaurantId()

      // Delete existing hours
      const { error: deleteError } = await runWithTimeout(
        () =>
          supabase
            .from('operating_hours')
            .delete()
            .eq('restaurant_id', activeRestaurantId),
        'Clearing previous operating hours timed out. Please retry.'
      )

      if (deleteError) throw deleteError

      // Insert new hours
      const { error: insertError } = await runWithTimeout(
        () =>
          supabase
            .from('operating_hours')
            .insert(
              data.operating_hours.map(h => ({
                restaurant_id: activeRestaurantId,
                day_of_week: h.day_of_week,
                open_time: h.open_time,
                close_time: h.close_time,
                is_closed: h.is_closed,
              }))
            ),
        'Saving operating hours timed out. Please retry.'
      )

      if (insertError) throw insertError

      // Update restaurant step
      const { error: stepError } = await runWithTimeout(
        () =>
          supabase
            .from('restaurants')
            .update({ onboarding_step: 5 })
            .eq('id', activeRestaurantId),
        'Updating onboarding progress timed out. Please retry.'
      )

      if (stepError) throw stepError

      setRestaurantId(activeRestaurantId)
    } catch (err) {
      const message = toErrorMessage(err, 'Failed to save hours')
      setError(message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [data.operating_hours, getActiveRestaurantId, runWithTimeout])

  // Save capacity (after step 5)
  const saveCapacity = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const activeRestaurantId = getActiveRestaurantId()

      // Update restaurant
      const { error: updateError } = await runWithTimeout(
        () =>
          supabase
            .from('restaurants')
            .update({
              seating_capacity: data.seating_capacity,
              table_count: data.table_count,
              onboarding_step: 6,
            })
            .eq('id', activeRestaurantId),
        'Saving capacity settings timed out. Please retry.'
      )

      if (updateError) throw updateError

      // Replace sections to avoid duplicates on retries/resume.
      const { error: deleteSectionsError } = await runWithTimeout(
        () =>
          supabase
            .from('sections')
            .delete()
            .eq('restaurant_id', activeRestaurantId),
        'Refreshing sections timed out. Please retry.'
      )

      if (deleteSectionsError) throw deleteSectionsError

      // Create sections
      const uniqueSections = Array.from(
        new Set(
          data.sections
            .map(section => section.trim())
            .filter(Boolean)
        )
      )

      if (uniqueSections.length > 0) {
        const { error: sectionsError } = await runWithTimeout(
          () =>
            supabase
              .from('sections')
              .insert(
                uniqueSections.map(name => ({
                  restaurant_id: activeRestaurantId,
                  name,
                  is_active: true,
                }))
              ),
          'Saving sections timed out. Please retry.'
        )

        if (sectionsError) {
          console.warn('[Onboarding] Could not create sections:', sectionsError.message)
        }
      }

      setRestaurantId(activeRestaurantId)
    } catch (err) {
      const message = toErrorMessage(err, 'Failed to save capacity')
      setError(message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [data, getActiveRestaurantId, runWithTimeout])

  // Save menu step progress (after step 6)
  const saveMenuProgress = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const activeRestaurantId = getActiveRestaurantId()
      const existingConfig = await fetchRestaurantConfig(activeRestaurantId)

      const { error: updateError } = await runWithTimeout(
        () =>
          supabase
            .from('restaurants')
            .update({
              config: {
                ...existingConfig,
                menu_import_method: data.menu_import_method,
              },
              onboarding_step: 7,
            })
            .eq('id', activeRestaurantId),
        'Saving menu setup timed out. Please retry.'
      )

      if (updateError) throw updateError
      setRestaurantId(activeRestaurantId)
    } catch (err) {
      const message = toErrorMessage(err, 'Failed to save menu setup')
      setError(message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [data.menu_import_method, getActiveRestaurantId, fetchRestaurantConfig, runWithTimeout])

  // Complete onboarding
  const completeOnboarding = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const activeRestaurantId = getActiveRestaurantId()
      const existingConfig = await fetchRestaurantConfig(activeRestaurantId)

      // Mark onboarding complete
      const { error: updateError } = await runWithTimeout(
        () =>
          supabase
            .from('restaurants')
            .update({
              config: {
                ...existingConfig,
                menu_import_method: data.menu_import_method,
                team_setup_method: data.team_setup_method,
                invites: data.invites,
              },
              status: 'active',
              onboarding_step: 8,
              onboarding_completed_at: new Date().toISOString(),
            })
            .eq('id', activeRestaurantId),
        'Finalizing onboarding timed out. Please retry.'
      )

      if (updateError) throw updateError

      // Refresh restaurant list in auth context
      await refreshRestaurants()

      // Show launch screen
      if (user) {
        clearDraft(user.id)
      }
      setShowLaunchScreen(true)
    } catch (err) {
      const message = toErrorMessage(err, 'Failed to complete onboarding')
      setError(message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [
    data.menu_import_method,
    data.team_setup_method,
    data.invites,
    getActiveRestaurantId,
    fetchRestaurantConfig,
    refreshRestaurants,
    runWithTimeout,
    user,
  ])

  // Navigate to dashboard (called from LaunchScreen)
  const goToDashboard = useCallback(() => {
    navigate('/', { replace: true })
  }, [navigate])

  return {
    // State
    currentStep,
    data,
    restaurantId,
    isLoading,
    error,
    showLaunchScreen,

    // Actions
    updateData,
    nextStep,
    prevStep,
    goToStep,
    createRestaurant,
    saveGoals,
    saveTechStack,
    saveOperatingHours,
    saveCapacity,
    saveMenuProgress,
    completeOnboarding,
    goToDashboard,

    // Helpers
    setError,
  }
}

export type UseOnboardingReturn = ReturnType<typeof useOnboarding>
