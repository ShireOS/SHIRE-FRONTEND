import { useEffect, useRef, useState } from 'react'
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
  match_quality: 'census_geography_match' | 'exact_official_boundary' | 'official_zip4_jurisdiction' | 'official_zip5_jurisdiction'
  match_id: string
  boundary_id?: number | null
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

const matchDescription = (match: LocationMatch) => {
  if (match.match_quality === 'census_geography_match') return 'Verified U.S. Census location'
  if (match.match_quality === 'exact_official_boundary') return 'Exact official address match'
  return 'Official ZIP tax jurisdiction match'
}

export function RestaurantLocationFields({ value, onChange, inputClassName = defaultInputClass }: Props) {
  const [matches, setMatches] = useState<LocationMatch[]>([])
  const [searched, setSearched] = useState(false)
  const [searching, setSearching] = useState(false)
  const [stateResolvable, setStateResolvable] = useState<boolean | null>(null)
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null)
  const [usingTypedAddress, setUsingTypedAddress] = useState(false)
  const [error, setError] = useState('')
  const requestSequence = useRef(0)
  const activeRequest = useRef<AbortController | null>(null)

  useEffect(() => () => activeRequest.current?.abort(), [])

  const cancelSearch = () => {
    requestSequence.current += 1
    activeRequest.current?.abort()
    activeRequest.current = null
    setSearching(false)
  }

  const patch = (next: Partial<RestaurantLocation>) => {
    cancelSearch()
    setMatches([])
    setSearched(false)
    setStateResolvable(null)
    setSelectedMatchId(null)
    setUsingTypedAddress(false)
    setError('')
    onChange(next)
  }

  const missingAddressFields = () => {
    const missing = [
      !value.address.trim() && 'street address',
      !value.city.trim() && 'city',
      !value.state.trim() && 'state',
      !value.postal_code.trim() && 'ZIP code',
    ].filter(Boolean) as string[]
    return missing
  }

  const useTypedAddress = () => {
    const missing = missingAddressFields()
    if (missing.length > 0) {
      setError(`Enter the ${missing.join(', ')} before using a manually entered address.`)
      return
    }
    cancelSearch()
    setMatches([])
    setSearched(true)
    setStateResolvable(null)
    setSelectedMatchId(null)
    setUsingTypedAddress(true)
    setError('')
  }

  const search = async () => {
    const missing = missingAddressFields()
    if (missing.length > 0) {
      setError(`Enter the ${missing.join(', ')} before verifying the address.`)
      return
    }
    activeRequest.current?.abort()
    const controller = new AbortController()
    const sequence = requestSequence.current + 1
    requestSequence.current = sequence
    activeRequest.current = controller
    setSearching(true)
    setUsingTypedAddress(false)
    setError('')
    try {
      const result = await fetchWithSupabaseAuth<SearchResponse>('/restaurant-locations/search', {
        method: 'POST',
        signal: controller.signal,
        timeoutMs: 12_000,
        body: JSON.stringify({
          address: value.address,
          city: value.city,
          state: value.state,
          postal_code: value.postal_code,
          country: value.country || 'US',
        }),
      })
      if (requestSequence.current !== sequence) return
      setMatches(result.matches || [])
      setStateResolvable(result.state_resolvable)
      setUsingTypedAddress(false)
      setSearched(true)
    } catch (searchError) {
      if (controller.signal.aborted || requestSequence.current !== sequence) return
      setError(messageFor(searchError))
      setMatches([])
      setSearched(true)
    } finally {
      if (requestSequence.current === sequence) {
        activeRequest.current = null
        setSearching(false)
      }
    }
  }

  const selectMatch = (match: LocationMatch) => {
    setSelectedMatchId(match.match_id)
    setUsingTypedAddress(false)
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
          {searching ? 'Verifying…' : 'Verify address'}
        </button>
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-white/10 bg-white/[0.025] p-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-5 text-[rgb(var(--text-tertiary))]">
          Can't find the address? Keep the complete address exactly as entered and continue setup manually.
        </p>
        <button
          type="button"
          onClick={useTypedAddress}
          className="shrink-0 rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold text-[rgb(var(--text-primary))] transition hover:border-white/30 hover:bg-white/5"
        >
          {searching ? 'Stop and use typed address' : 'Use typed address'}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-400/25 bg-red-400/[0.07] p-3 text-sm text-red-200" role="alert">
          <p>{error}</p>
          <p className="mt-1 text-xs text-red-100/75">You can correct the fields and retry, or use the complete typed address manually.</p>
        </div>
      )}
      {matches.length > 0 && (
        <div className="space-y-2 rounded-xl border border-white/10 bg-black/10 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--text-tertiary))]">Verified address matches</p>
          {matches.map(match => (
            <button
              key={match.match_id}
              type="button"
              onClick={() => selectMatch(match)}
              className={`w-full rounded-lg border px-3 py-3 text-left text-sm transition ${selectedMatchId === match.match_id ? 'border-emerald-400/45 bg-emerald-400/10' : 'border-white/10 bg-white/[0.025] hover:border-white/20'}`}
            >
              <span className="block font-medium text-[rgb(var(--text-primary))]">{match.address}</span>
              <span className="mt-1 block text-xs text-[rgb(var(--text-tertiary))]">
                {match.city}, {match.state} {match.postal_code} · {matchDescription(match)}
              </span>
            </button>
          ))}
        </div>
      )}
      {usingTypedAddress && (
        <div className="rounded-lg border border-emerald-400/25 bg-emerald-400/[0.07] p-3 text-sm leading-5 text-emerald-100" role="status">
          Using the address exactly as entered. You can continue setup; tax coverage will remain unresolved until this location can be matched or reviewed.
        </div>
      )}
      {searched && matches.length === 0 && !usingTypedAddress && !error && (
        <div className="rounded-lg border border-amber-400/25 bg-amber-400/[0.07] p-3 text-sm leading-5 text-amber-100">
          {stateResolvable
            ? 'No authoritative geographic match was found. Choose Use typed address to continue manually; taxes will remain unresolved until an assigned reseller or platform admin fills the missing values.'
            : 'SHIRE does not yet have an authoritative tax source for this state. Choose Use typed address to continue manually; taxes remain unresolved and editable only by an assigned reseller or platform admin.'}
        </div>
      )}
    </div>
  )
}
