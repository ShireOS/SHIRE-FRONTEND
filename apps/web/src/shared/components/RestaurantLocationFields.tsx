import { useState } from 'react'
import { fetchWithSupabaseAuth } from '../query/fetchWithSupabaseAuth'

export type RestaurantLocation = {
  address: string
  city: string
  state: string
  postal_code: string
  country?: string
  latitude?: number | null
  longitude?: number | null
}

type LocationMatch = RestaurantLocation & {
  match_quality: 'exact_official_boundary' | 'official_zip4_jurisdiction' | 'official_zip5_jurisdiction'
  source: 'sst_boundary'
  source_version: string
  boundary_id: number
}

type SearchResponse = {
  matches: LocationMatch[]
  manual_allowed: boolean
  catalog_configured: boolean
  state_resolvable: boolean
}

type Props = {
  value: RestaurantLocation
  onChange: (patch: Partial<RestaurantLocation>) => void
  inputClassName?: string
}

const defaultInputClass = 'w-full px-4 py-3 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] rounded-lg text-[rgb(var(--text-primary))] placeholder-[rgb(var(--text-tertiary))] focus:outline-none focus:ring-2 focus:ring-[rgba(212,168,84,0.5)] focus:border-transparent transition-all'

const messageFor = (error: unknown) => error instanceof Error
  ? error.message
  : 'Could not search the official address catalog.'

export function RestaurantLocationFields({ value, onChange, inputClassName = defaultInputClass }: Props) {
  const [matches, setMatches] = useState<LocationMatch[]>([])
  const [searched, setSearched] = useState(false)
  const [searching, setSearching] = useState(false)
  const [stateResolvable, setStateResolvable] = useState<boolean | null>(null)
  const [selectedBoundaryId, setSelectedBoundaryId] = useState<number | null>(null)
  const [error, setError] = useState('')

  const patch = (next: Partial<RestaurantLocation>) => {
    setMatches([])
    setSearched(false)
    setStateResolvable(null)
    setSelectedBoundaryId(null)
    setError('')
    onChange(next)
  }

  const search = async () => {
    if (!value.address.trim() || !value.city.trim() || !value.state.trim() || !value.postal_code.trim()) {
      setError('Enter the street, city, state, and ZIP before searching.')
      return
    }
    setSearching(true)
    setError('')
    try {
      const result = await fetchWithSupabaseAuth<SearchResponse>('/restaurant-locations/search', {
        method: 'POST',
        body: JSON.stringify({
          address: value.address,
          city: value.city,
          state: value.state,
          postal_code: value.postal_code,
          country: value.country || 'US',
        }),
      })
      setMatches(result.matches || [])
      setStateResolvable(result.state_resolvable)
      setSearched(true)
    } catch (searchError) {
      setError(messageFor(searchError))
      setMatches([])
      setSearched(false)
    } finally {
      setSearching(false)
    }
  }

  const selectMatch = (match: LocationMatch) => {
    setSelectedBoundaryId(match.boundary_id)
    setError('')
    onChange({
      address: match.address,
      city: match.city,
      state: match.state,
      postal_code: match.postal_code,
      country: match.country || 'US',
      latitude: match.latitude,
      longitude: match.longitude,
    })
  }

  return (
    <div className="space-y-4">
      <input
        type="text"
        required
        value={value.address}
        onChange={event => patch({ address: event.target.value })}
        className={inputClassName}
        placeholder="123 Main Street"
        autoComplete="street-address"
      />
      <div className="grid grid-cols-2 gap-4">
        <input type="text" required value={value.city} onChange={event => patch({ city: event.target.value })} className={inputClassName} placeholder="City" autoComplete="address-level2" />
        <input type="text" required value={value.state} onChange={event => patch({ state: event.target.value })} className={inputClassName} placeholder="State" autoComplete="address-level1" />
      </div>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <input type="text" required value={value.postal_code} onChange={event => patch({ postal_code: event.target.value })} className={inputClassName} placeholder="ZIP Code" autoComplete="postal-code" />
        <button
          type="button"
          onClick={() => void search()}
          disabled={searching}
          className="rounded-lg border border-[rgba(201,169,98,0.45)] bg-[rgba(201,169,98,0.1)] px-4 py-3 text-sm font-semibold text-[rgb(var(--text-primary))] transition hover:bg-[rgba(201,169,98,0.16)] disabled:opacity-50"
        >
          {searching ? 'Finding…' : 'Find exact address'}
        </button>
      </div>

      {error && <p className="text-sm text-red-300">{error}</p>}
      {matches.length > 0 && (
        <div className="space-y-2 rounded-xl border border-white/10 bg-black/10 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--text-tertiary))]">Official location / jurisdiction matches</p>
          {matches.map(match => (
            <button
              key={match.boundary_id}
              type="button"
              onClick={() => selectMatch(match)}
              className={`w-full rounded-lg border px-3 py-3 text-left text-sm transition ${selectedBoundaryId === match.boundary_id ? 'border-emerald-400/45 bg-emerald-400/10' : 'border-white/10 bg-white/[0.025] hover:border-white/20'}`}
            >
              <span className="block font-medium text-[rgb(var(--text-primary))]">{match.address}</span>
              <span className="mt-1 block text-xs text-[rgb(var(--text-tertiary))]">
                {match.city}, {match.state} {match.postal_code} · {match.match_quality === 'exact_official_boundary' ? 'exact official address' : 'official ZIP jurisdiction'} · {match.source_version}
              </span>
            </button>
          ))}
        </div>
      )}
      {searched && matches.length === 0 && (
        <div className="rounded-lg border border-amber-400/25 bg-amber-400/[0.07] p-3 text-sm leading-5 text-amber-100">
          {stateResolvable
            ? 'No exact official boundary match was found. You may keep the typed address, but taxes remain unresolved until an assigned reseller or platform admin fills the missing values.'
            : 'This state is not loaded in SHIRE’s official address catalog yet. You may keep the typed address; taxes remain unresolved and editable only by an assigned reseller or platform admin.'}
        </div>
      )}
    </div>
  )
}
