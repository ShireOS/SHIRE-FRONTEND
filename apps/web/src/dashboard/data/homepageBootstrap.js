export async function loadRestaurantHomepageBootstrap(request, restaurantId, signal) {
  const options = signal ? { signal } : undefined

  try {
    return await request(
      `/restaurants/${restaurantId}/reports/homepage/bootstrap`,
      options,
    )
  } catch (error) {
    if (error?.status !== 404) throw error
  }

  const [viewPreferences, preferences] = await Promise.all([
    request(`/restaurants/${restaurantId}/reports/view-preferences`, options),
    request(`/restaurants/${restaurantId}/reports/homepage/preferences`, options),
  ])

  return {
    view_settings: viewPreferences?.settings?.homepage || {},
    preferences,
  }
}
