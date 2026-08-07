import { useState } from 'react'
import { UNGROUPED_ID, buildGroupCards } from '../../reseller/data/resellerPortfolio'

// Target picker for multi-store propagation of a setup/menu change. Moved out
// of ResellerApp so menu surfaces can host it without an import cycle.
export function PropagationModal({ request, restaurants, groups, sourceRestaurantId, onCancel, onApply }) {
  const descriptor = request.descriptor || {}
  const [tab, setTab] = useState('restaurants')
  const [showAllRestaurants, setShowAllRestaurants] = useState(false)

  const sourceRestaurant = restaurants.find((item) => item.id === sourceRestaurantId)
  const sourceGroupId = sourceRestaurant?.reseller_group_id || UNGROUPED_ID
  const sourceGroupName = sourceRestaurant?.reseller_group_name || 'Ungrouped'

  const restaurantsInSourceGroup = restaurants.filter((item) => item.reseller_group_id === sourceGroupId)
  const visibleRestaurants = showAllRestaurants ? restaurants : restaurantsInSourceGroup
  const defaultRestaurantIds = descriptor.propagation === 'general'
    ? restaurantsInSourceGroup.map((item) => item.id)
    : [sourceRestaurantId]
  const [selectedRestaurantIds, setSelectedRestaurantIds] = useState(() => new Set(defaultRestaurantIds))
  const [selectedGroupIds, setSelectedGroupIds] = useState(() => new Set(
    descriptor.propagation === 'general' ? [sourceGroupId] : []
  ))

  const groupCards = buildGroupCards(restaurants, groups)
  const selectedCount = tab === 'groups'
    ? restaurants.filter((restaurant) => selectedGroupIds.has(restaurant.reseller_group_id)).length
    : selectedRestaurantIds.size
  const visibleIds = visibleRestaurants.map((item) => item.id)
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedRestaurantIds.has(id))

  const toggleRestaurant = (restaurantId) => {
    setSelectedRestaurantIds((current) => {
      const next = new Set(current)
      if (next.has(restaurantId)) next.delete(restaurantId)
      else next.add(restaurantId)
      return next
    })
  }

  const toggleVisibleRestaurants = () => {
    setSelectedRestaurantIds((current) => {
      const next = new Set(current)
      if (allVisibleSelected) {
        visibleIds.forEach((id) => next.delete(id))
      } else {
        visibleIds.forEach((id) => next.add(id))
      }
      return next
    })
  }

  const toggleGroup = (groupId) => {
    setSelectedGroupIds((current) => {
      const next = new Set(current)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return next
    })
  }

  const apply = () => {
    if (tab === 'groups') {
      const ids = restaurants
        .filter((restaurant) => selectedGroupIds.has(restaurant.reseller_group_id))
        .map((restaurant) => restaurant.id)
      onApply([...new Set(ids)])
      return
    }
    onApply([...selectedRestaurantIds])
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl border border-white/10 bg-[#141414] shadow-2xl">
        <div className="border-b border-white/10 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="label-mono">Apply Change</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight">{descriptor.label || 'Setup change'}</h2>
              <p className="mt-2 max-w-2xl text-sm text-dash-secondary">
                Default: {descriptor.propagation === 'general' ? `all restaurants in ${sourceGroupName}` : sourceRestaurant?.name || 'this restaurant'}.
              </p>
            </div>
            <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-dash-secondary">
              {descriptor.propagation === 'general' ? 'General' : 'Specified'}
            </span>
          </div>
          <div className="mt-5 flex rounded-xl border border-white/10 bg-white/[0.03] p-1">
            {['restaurants', 'groups'].map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setTab(item)}
                className={`rounded-lg px-3 py-2 text-sm font-semibold capitalize transition ${
                  tab === item ? 'bg-white text-black' : 'text-dash-secondary hover:bg-white/10 hover:text-dash-cream'
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-5">
          {tab === 'restaurants' ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm text-dash-secondary">
                  Showing {showAllRestaurants ? 'all reseller restaurants' : sourceGroupName}. {selectedRestaurantIds.size} selected.
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAllRestaurants((value) => !value)}
                    className="h-10 rounded-xl border border-white/10 px-3 text-sm font-semibold text-dash-secondary hover:bg-white/10 hover:text-dash-cream"
                  >
                    {showAllRestaurants ? 'Show current group only' : 'Apply to restaurants outside this group'}
                  </button>
                  <button
                    type="button"
                    onClick={toggleVisibleRestaurants}
                    className="h-10 rounded-xl bg-white px-3 text-sm font-semibold text-black"
                  >
                    {allVisibleSelected ? 'Unselect shown' : 'Select all shown'}
                  </button>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {visibleRestaurants.map((restaurant) => (
                  <label
                    key={restaurant.id}
                    className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-white/[0.035] p-4 hover:bg-white/[0.06]"
                  >
                    <input
                      type="checkbox"
                      checked={selectedRestaurantIds.has(restaurant.id)}
                      onChange={() => toggleRestaurant(restaurant.id)}
                      className="mt-1"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{restaurant.name}</span>
                      <span className="mt-1 flex items-center gap-2 text-sm text-dash-secondary">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: restaurant.reseller_group_color }} />
                        {restaurant.reseller_group_name}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-dash-secondary">
                Group mode applies to every restaurant currently inside each selected group. Pick individual restaurants in the Restaurants tab for finer control.
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                {groupCards.map((group) => (
                  <label
                    key={group.id}
                    className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-white/[0.035] p-4 hover:bg-white/[0.06]"
                  >
                    <input
                      type="checkbox"
                      checked={selectedGroupIds.has(group.id)}
                      onChange={() => toggleGroup(group.id)}
                      className="mt-1"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 font-semibold">
                        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: group.color }} />
                        {group.name}
                      </span>
                      <span className="mt-1 block text-sm text-dash-secondary">{group.restaurant_count} restaurants</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 p-5">
          <p className="text-sm text-dash-secondary">{selectedCount} restaurant{selectedCount === 1 ? '' : 's'} will be updated.</p>
          <div className="flex gap-2">
            <button type="button" onClick={onCancel} className="h-10 rounded-xl border border-white/10 px-4 text-sm font-semibold text-dash-secondary hover:bg-white/10">
              Cancel
            </button>
            <button
              type="button"
              onClick={apply}
              disabled={selectedCount === 0}
              className="h-10 rounded-xl bg-white px-4 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-40"
            >
              Apply to selected
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
