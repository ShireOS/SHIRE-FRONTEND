import { useEffect, useMemo, useState } from 'react'
import { fetchWithSupabaseAuth } from '../../shared/query/fetchWithSupabaseAuth'

type TaxClassOption = { key: string; label: string }
type TaxRate = {
  id?: string
  name: string
  rate: string | number
  applies_to: string
  is_default?: boolean
  is_inclusive?: boolean
}
type CategoryAssignment = {
  category_id: string
  category_name: string
}
type TaxPayload = {
  tax_rates?: TaxRate[]
  category_assignments?: CategoryAssignment[]
  tax_source?: {
    status?: string
    location_display?: string
    verified_at?: string | null
    address_type?: string | null
  }
  tax_provider?: {
    provider?: string
    configured?: boolean
    prepared_food_configured?: boolean
    available_tax_classes?: TaxClassOption[]
  }
  tax_profile?: {
    enabled_tax_classes?: string[]
    category_assignments?: Record<string, string>
  }
}

interface Props {
  restaurantId: string | null
  locationDisplay?: string
  onResolved?: (payload: TaxPayload) => void
}

const statusLabel = (status?: string) => {
  if (status === 'verified') return 'Verified'
  if (status === 'incomplete') return 'Address incomplete'
  return 'Verification required'
}

const errorMessage = (error: unknown) => {
  if (!(error instanceof Error)) return 'Tax verification failed.'
  try {
    const parsed = JSON.parse(error.message)
    if (parsed && typeof parsed.message === 'string') return parsed.message
  } catch {
    // The shared API helper already returns plain messages for ordinary errors.
  }
  return error.message
}

export function TaxJurisdictionPanel({ restaurantId, locationDisplay, onResolved }: Props) {
  const [payload, setPayload] = useState<TaxPayload | null>(null)
  const [enabledClasses, setEnabledClasses] = useState<string[]>([])
  const [classifications, setClassifications] = useState<Record<string, string>>({})
  const [reason, setReason] = useState('Verified restaurant address and sales profile')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    if (!restaurantId) {
      setLoading(false)
      return () => { active = false }
    }
    setLoading(true)
    setError('')
    fetchWithSupabaseAuth<TaxPayload>(`/restaurants/${restaurantId}/taxes-charges`)
      .then((next) => {
        if (!active) return
        setPayload(next)
        const available = next.tax_provider?.available_tax_classes || []
        const availableKeys = new Set(available.map(option => option.key))
        const savedClasses = (next.tax_profile?.enabled_tax_classes || [])
          .filter(value => availableKeys.has(value))
        const defaults = savedClasses.length
          ? savedClasses
          : availableKeys.has('prepared_food')
            ? ['prepared_food']
            : available[0]?.key
              ? [available[0].key]
              : []
        setEnabledClasses(defaults)
        setClassifications(next.tax_profile?.category_assignments || {})
      })
      .catch((err) => {
        if (active) setError(errorMessage(err))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [restaurantId])

  const categories = payload?.category_assignments || []
  const availableClasses = payload?.tax_provider?.available_tax_classes || []
  const requiresExplicitCategories = enabledClasses.length > 1
  const categoriesComplete = !requiresExplicitCategories || categories.every(
    category => enabledClasses.includes(classifications[category.category_id]),
  )
  const visibleRates = useMemo(() => {
    const rows = payload?.tax_rates || []
    if (payload?.tax_source?.status === 'verified') return rows
    return rows.filter(row => Number(row.rate) > 0)
  }, [payload])

  const toggleClass = (key: string) => {
    setEnabledClasses(current => {
      if (current.includes(key)) {
        if (current.length === 1) return current
        return current.filter(value => value !== key)
      }
      return [...current, key]
    })
  }

  const resolveTaxes = async () => {
    if (!restaurantId) return
    setSaving(true)
    setError('')
    try {
      const next = await fetchWithSupabaseAuth<TaxPayload>(
        `/restaurants/${restaurantId}/taxes-charges/resolve`,
        {
          method: 'POST',
          body: JSON.stringify({
            enabled_tax_classes: enabledClasses,
            category_assignments: categories.map(category => ({
              category_id: category.category_id,
              tax_class: classifications[category.category_id] || enabledClasses[0],
            })),
            reason: reason.trim(),
          }),
        },
      )
      setPayload(next)
      setClassifications(next.tax_profile?.category_assignments || {})
      onResolved?.(next)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const providerConfigured = Boolean(payload?.tax_provider?.configured)
  const canResolve = Boolean(
    providerConfigured
    && enabledClasses.length
    && categoriesComplete
    && reason.trim().length >= 3
    && !saving,
  )

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[rgba(201,169,98,0.25)] bg-[rgba(201,169,98,0.06)] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[rgb(var(--gold))]">Restaurant location</p>
            <p className="mt-2 text-sm text-[rgb(var(--text-primary))]">
              {payload?.tax_source?.location_display || locationDisplay || 'Complete Store Information to resolve taxes.'}
            </p>
          </div>
          <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${payload?.tax_source?.status === 'verified' ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300' : 'border-amber-400/30 bg-amber-400/10 text-amber-200'}`}>
            {statusLabel(payload?.tax_source?.status)}
          </span>
        </div>
        {payload?.tax_source?.verified_at && (
          <p className="mt-2 text-xs text-[rgb(var(--text-tertiary))]">
            Provider verified {new Date(payload.tax_source.verified_at).toLocaleString()}.
          </p>
        )}
      </div>

      {loading ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.025] p-4 text-sm text-[rgb(var(--text-secondary))]">Loading tax jurisdictions…</div>
      ) : !providerConfigured ? (
        <div className="rounded-xl border border-amber-400/25 bg-amber-400/[0.07] p-4 text-sm leading-6 text-amber-100">
          Automatic address and tax verification is awaiting platform provider setup. A placeholder 0% rate is not treated as valid and POS tax settings will not be changed.
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
            <p className="text-sm font-semibold text-[rgb(var(--text-primary))]">What this location sells</p>
            <p className="mt-1 text-xs leading-5 text-[rgb(var(--text-tertiary))]">
              Choose product classes, not percentages. The provider resolves state, county, city, district, and product-specific taxes from the verified address.
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {availableClasses.map(option => (
                <label key={option.key} className="flex items-center gap-3 rounded-lg border border-white/10 bg-black/10 px-3 py-2.5 text-sm text-[rgb(var(--text-primary))]">
                  <input
                    type="checkbox"
                    checked={enabledClasses.includes(option.key)}
                    onChange={() => toggleClass(option.key)}
                    className="h-4 w-4 accent-[rgb(var(--gold))]"
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </div>

          {requiresExplicitCategories && categories.length > 0 && (
            <div className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
              <p className="text-sm font-semibold text-[rgb(var(--text-primary))]">Classify every menu category</p>
              <p className="mt-1 text-xs leading-5 text-[rgb(var(--text-tertiary))]">This maps each existing POS category to its provider-derived rate. SHIRE will not guess alcohol from a category name.</p>
              <div className="mt-3 space-y-2">
                {categories.map(category => (
                  <label key={category.category_id} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(220px,1fr)] sm:items-center">
                    <span className="text-sm text-[rgb(var(--text-primary))]">{category.category_name}</span>
                    <select
                      value={classifications[category.category_id] || ''}
                      onChange={event => setClassifications(current => ({ ...current, [category.category_id]: event.target.value }))}
                      className="min-h-10 rounded-lg border border-white/10 bg-[#171613] px-3 text-sm text-[rgb(var(--text-primary))]"
                    >
                      <option value="">Choose sales class</option>
                      {availableClasses.filter(option => enabledClasses.includes(option.key)).map(option => (
                        <option key={option.key} value={option.key}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            </div>
          )}

          <label className="block space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--text-tertiary))]">Audit reason</span>
            <input
              value={reason}
              onChange={event => setReason(event.target.value.slice(0, 500))}
              className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-[rgb(var(--text-primary))] outline-none focus:border-[rgb(var(--gold))]"
            />
          </label>
          {!categoriesComplete && <p className="text-sm text-amber-200">Classify every active menu category before verification.</p>}
          <button
            type="button"
            disabled={!canResolve}
            onClick={resolveTaxes}
            className="rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? 'Validating address and taxes…' : 'Validate address & refresh taxes'}
          </button>
        </>
      )}

      {error && <div className="rounded-xl border border-red-400/25 bg-red-400/[0.07] p-4 text-sm text-red-200">{error}</div>}

      {visibleRates.length > 0 ? (
        <div className="space-y-3">
          {visibleRates.map((tax, index) => (
            <div key={tax.id || `tax:${index}`} className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-[rgb(var(--text-primary))]">{tax.name}</p>
                  <p className="mt-1 text-xs text-[rgb(var(--text-tertiary))]">
                    {tax.is_default ? 'Default · ' : ''}{tax.is_inclusive ? 'Included in price' : 'Added at checkout'}
                  </p>
                </div>
                <p className="text-lg font-semibold tabular-nums text-[rgb(var(--gold))]">{Number(tax.rate || 0)}%</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-white/15 bg-white/[0.02] p-4 text-sm text-[rgb(var(--text-secondary))]">
          No verified tax rates are active for this location.
        </div>
      )}
    </div>
  )
}
