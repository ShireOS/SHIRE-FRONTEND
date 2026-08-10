import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowUpRight, Pencil, Plus, Trash2 } from 'lucide-react'
import {
  MYRTLE_BEACH_CITY_LIMITS_TAX_PRESET,
  taxAppliesToOptions,
  taxPresetDraft,
} from '@shire/settings'
import { fetchCached, fetchWithSupabaseAuth, queryClient, queryKeys, STALE_TIMES } from '../../shared/query'
import { Modal, ModalFooter } from '../components/shared/Modal'

const SUB_TABS = [
  { id: 'rates', label: 'Tax rates' },
  { id: 'split-items', label: 'Split-priced items' },
]

const money = (value) => `$${Number(value || 0).toFixed(2)}`
const rateLabel = (rate) => `${String(Number(Number(rate || 0).toFixed(3)))}%`

function PricingPill({ inclusive }) {
  return inclusive ? (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-dash-gold/40 bg-dash-gold/10 px-2.5 py-0.5 text-xs font-semibold text-dash-gold">
      <span className="h-1.5 w-1.5 rounded-full bg-dash-gold" />
      Included in price
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-dash-border bg-dash-panel px-2.5 py-0.5 text-xs font-semibold text-dash-secondary">
      <span className="h-1.5 w-1.5 rounded-full bg-dash-tertiary" />
      Added at checkout
    </span>
  )
}

// Sample-math preview so "included vs added" is unambiguous while editing.
function PricingPreview({ ratePercent, inclusive }) {
  const rate = Math.max(0, Number(ratePercent) || 0) / 100
  const sample = 10
  if (inclusive) {
    const net = sample / (1 + rate)
    return (
      <div className="mt-3 rounded-xl border border-dash-border bg-dash-panel px-3.5 py-3 text-xs">
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-dash-tertiary">Example · $10.00 item</p>
        <div className="mt-1.5 flex justify-between text-dash-secondary"><span>Guest pays</span><span className="tabular-nums text-dash-cream">{money(sample)}</span></div>
        <div className="flex justify-between text-dash-secondary"><span>Tax (backed out)</span><span className="tabular-nums text-dash-cream">{money(sample - net)}</span></div>
        <div className="mt-1 flex justify-between border-t border-dash-border pt-1.5 font-semibold text-dash-cream"><span>You keep</span><span className="tabular-nums">{money(net)}</span></div>
      </div>
    )
  }
  return (
    <div className="mt-3 rounded-xl border border-dash-border bg-dash-panel px-3.5 py-3 text-xs">
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-dash-tertiary">Example · $10.00 item</p>
      <div className="mt-1.5 flex justify-between text-dash-secondary"><span>Menu price</span><span className="tabular-nums text-dash-cream">{money(sample)}</span></div>
      <div className="flex justify-between text-dash-secondary"><span>Tax (added on check)</span><span className="tabular-nums text-dash-cream">{money(sample * rate)}</span></div>
      <div className="mt-1 flex justify-between border-t border-dash-border pt-1.5 font-semibold text-dash-cream"><span>Guest pays</span><span className="tabular-nums">{money(sample * (1 + rate))}</span></div>
    </div>
  )
}

export default function TaxesPage({ restaurantId }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [subTab, setSubTab] = useState('rates')
  const [taxRates, setTaxRates] = useState([])
  const [serviceCharges, setServiceCharges] = useState([])
  const [categories, setCategories] = useState([])
  const [splitItems, setSplitItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [draft, setDraft] = useState(null) // { id?, name, rate, applies_to, is_inclusive, is_default, categoryIds }

  const api = (path, init) => fetchWithSupabaseAuth(path, init)

  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(''), 3500)
    return () => clearTimeout(timer)
  }, [notice])

  const load = async (force = false) => {
    const staleTime = force ? 0 : STALE_TIMES.setup
    const [taxes, categoryData, allocations] = await Promise.all([
      fetchCached(queryKeys.taxesCharges(restaurantId), () => api(`/restaurants/${restaurantId}/taxes-charges`), staleTime),
      fetchCached(queryKeys.menuCategories(restaurantId), () => api(`/restaurants/${restaurantId}/menu/categories`), staleTime),
      fetchCached(queryKeys.priceAllocations(restaurantId), () => api(`/restaurants/${restaurantId}/menu/price-allocations`), staleTime).catch(() => ({ items: [] })),
    ])
    setTaxRates(taxes?.tax_rates || [])
    setServiceCharges(taxes?.service_charges || [])
    setCategories(Array.isArray(categoryData) ? categoryData : (categoryData?.categories || []))
    setSplitItems(allocations?.items || [])
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    load()
      .catch((err) => { if (!cancelled) setError(err.message || 'Could not load taxes.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [restaurantId]) // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (work, successMessage, failLabel) => {
    setBusy(true)
    setError('')
    try {
      const result = await work()
      if (typeof result === 'string') setNotice(result)
      else if (successMessage) setNotice(successMessage)
      return true
    } catch (err) {
      setError(`${failLabel}: ${err.message || 'something went wrong.'}`)
      return false
    } finally {
      setBusy(false)
    }
  }

  const categoriesByTax = useMemo(() => {
    const map = {}
    for (const category of categories) {
      if (!category.tax_rate_id) continue
      if (!map[category.tax_rate_id]) map[category.tax_rate_id] = []
      map[category.tax_rate_id].push(category)
    }
    return map
  }, [categories])

  const toTaxInput = (row) => ({
    id: row.id,
    name: row.name,
    rate: Number(row.rate) || 0,
    applies_to: row.applies_to || 'all',
    is_default: Boolean(row.is_default),
    is_inclusive: Boolean(row.is_inclusive),
    is_active: true,
  })

  const toChargeInput = (row) => ({
    id: row.id,
    name: row.name,
    display_label: row.display_label || null,
    charge_type: row.charge_type || 'percentage',
    amount: Number(row.amount) || 0,
    applies_to: row.applies_to || 'all',
    taxable: Boolean(row.taxable),
    auto_apply: Boolean(row.auto_apply),
    is_tip: Boolean(row.is_tip),
    is_active: true,
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.taxesCharges(restaurantId) })
    queryClient.invalidateQueries({ queryKey: queryKeys.menuCategories(restaurantId) })
    queryClient.invalidateQueries({ queryKey: queryKeys.priceAllocations(restaurantId) })
  }

  // The taxes-charges PUT is a full replace, so every save re-sends the whole
  // active list with the edited row swapped in (or appended).
  const putTaxes = async (nextTaxRates, categoryAssignments) => api(`/restaurants/${restaurantId}/taxes-charges`, {
    method: 'PUT',
    body: JSON.stringify({
      tax_rates: nextTaxRates,
      service_charges: serviceCharges.map(toChargeInput),
      ...(categoryAssignments !== undefined ? { category_assignments: categoryAssignments } : {}),
    }),
  })

  const openEditor = (tax) => {
    setDraft(tax ? {
      id: tax.id,
      name: tax.name,
      rate: String(Number(tax.rate) || 0),
      applies_to: tax.applies_to || 'all',
      is_inclusive: Boolean(tax.is_inclusive),
      is_default: Boolean(tax.is_default),
      categoryIds: new Set((categoriesByTax[tax.id] || []).map((c) => c.id)),
    } : {
      id: null,
      name: '',
      rate: '',
      applies_to: 'all',
      is_inclusive: false,
      is_default: taxRates.length === 0,
      categoryIds: new Set(),
    })
  }

  const saveDraft = async () => {
    const name = draft.name.trim()
    const rate = Number(draft.rate)
    if (!name) { setError('Give the tax a name.'); return }
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) { setError('Rate must be between 0 and 100%.'); return }

    const ok = await run(async () => {
      let next = taxRates.map(toTaxInput)
      const edited = { id: draft.id || undefined, name, rate, applies_to: draft.applies_to, is_default: draft.is_default, is_inclusive: draft.is_inclusive, is_active: true }
      if (draft.id) next = next.map((row) => (row.id === draft.id ? edited : row))
      else next = [...next, edited]
      if (edited.is_default) next = next.map((row) => (row === edited ? row : { ...row, is_default: false }))

      const categoryAssignments = categories.flatMap((category) => {
        if (draft.categoryIds.has(category.id)) return [{ category_name: category.name, tax_name: name }]
        if (draft.id && category.tax_rate_id === draft.id) return [{ category_name: category.name, tax_name: null }]
        return []
      })
      const saved = await putTaxes(next, categoryAssignments)
      const savedRates = saved?.tax_rates || []
      setTaxRates(savedRates)
      setServiceCharges(saved?.service_charges || [])
      invalidate()
      await load(true)
      const warnings = saved?.category_assignment_warnings || []
      if (warnings.length) return `Tax saved. ${warnings.join(' ')}`
    }, `Tax "${name}" saved.`, 'Couldn’t save the tax')
    if (ok) setDraft(null)
  }

  const deactivateTax = (tax) => {
    const assigned = categoriesByTax[tax.id] || []
    const warning = assigned.length
      ? `Remove "${tax.name}"? ${assigned.length} categor${assigned.length === 1 ? 'y' : 'ies'} will fall back to the default tax.`
      : `Remove "${tax.name}"?`
    if (!window.confirm(warning)) return
    run(async () => {
      const saved = await putTaxes(
        taxRates.filter((row) => row.id !== tax.id).map(toTaxInput),
        assigned.map((category) => ({ category_name: category.name, tax_name: null })),
      )
      setTaxRates(saved?.tax_rates || [])
      setServiceCharges(saved?.service_charges || [])
      invalidate()
      await load(true)
      const warnings = saved?.category_assignment_warnings || []
      if (warnings.length) return `Tax removed. ${warnings.join(' ')}`
    }, `Tax "${tax.name}" removed.`, 'Couldn’t remove the tax')
  }

  const goToMenu = () => navigate(location.pathname.replace(/\/taxes\/?$/, '/menu'))

  const toggleDraftCategory = (categoryId) => {
    setDraft((prev) => {
      const next = new Set(prev.categoryIds)
      if (next.has(categoryId)) next.delete(categoryId)
      else next.add(categoryId)
      return { ...prev, categoryIds: next }
    })
  }

  const applyMyrtleBeachTaxes = () => {
    if (!window.confirm('Confirm this restaurant is inside Myrtle Beach city limits. This replaces its active tax rates and assigns Beer & Wine and Cocktails to their correct rates.')) return
    run(async () => {
      const preset = taxPresetDraft(MYRTLE_BEACH_CITY_LIMITS_TAX_PRESET)
      const saved = await putTaxes(preset.tax_rates, preset.category_assignments)
      invalidate()
      await load(true)
      const warnings = saved?.category_assignment_warnings || []
      if (warnings.length) return `Rates applied. ${warnings.join(' ')}`
      return 'Myrtle Beach city-limits taxes applied.'
    }, 'Myrtle Beach city-limits taxes applied.', 'Couldn’t apply the tax preset')
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-dash-cream">Taxes</h1>
          <p className="mt-1 max-w-xl text-sm text-dash-secondary">
            Every tax in one place. Assign taxes to menu categories and choose whether each one is
            built into your menu prices or added at checkout.
          </p>
        </div>
        {subTab === 'rates' && <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={applyMyrtleBeachTaxes}
            disabled={busy}
            className="rounded-lg border border-dash-gold/50 px-3 py-2 text-sm font-semibold text-dash-gold hover:bg-dash-gold/10 disabled:opacity-50"
          >
            Use Myrtle Beach rates
          </button>
          <button
            type="button"
            onClick={() => openEditor(null)}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-dash-gold px-4 py-2 text-sm font-semibold text-dash-base hover:brightness-105 disabled:opacity-50"
          >
            <Plus size={15} /> New tax
          </button>
        </div>}
      </div>

      <div className="flex gap-2">
        {SUB_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setSubTab(tab.id)}
            className={`rounded-lg border px-3 py-1.5 text-sm ${subTab === tab.id
              ? 'border-dash-gold/50 bg-dash-gold/10 font-semibold text-dash-gold'
              : 'border-dash-border text-dash-secondary hover:text-dash-cream'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error ? <div className="rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-2.5 text-sm text-red-200">{error}</div> : null}
      {notice ? <div className="rounded-xl border border-dash-gold/30 bg-dash-gold/10 px-4 py-2.5 text-sm text-dash-gold">{notice}</div> : null}

      {loading ? (
        <div className="rounded-2xl border border-dash-border bg-dash-panel p-6 text-sm text-dash-secondary">Loading taxes…</div>
      ) : subTab === 'rates' ? (
        <section className="rounded-2xl border border-dash-border bg-dash-panel p-5">
          {taxRates.length === 0 ? (
            <p className="text-sm text-dash-secondary">No taxes yet — create one to get started.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b border-dash-border text-left font-mono text-[10px] uppercase tracking-[0.08em] text-dash-tertiary">
                    <th className="py-2 pr-3">Tax</th>
                    <th className="py-2 pr-3">Rate</th>
                    <th className="py-2 pr-3">Applies to</th>
                    <th className="py-2 pr-3">Pricing</th>
                    <th className="py-2 pr-3">Default</th>
                    <th className="py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {taxRates.map((tax) => {
                    const assigned = categoriesByTax[tax.id] || []
                    return (
                      <tr key={tax.id} className="border-b border-dash-border/50 text-dash-cream">
                        <td className="py-3 pr-3 font-semibold">{tax.name}</td>
                        <td className="py-3 pr-3 tabular-nums">{rateLabel(tax.rate)}</td>
                        <td className="py-3 pr-3 text-dash-secondary">
                          {assigned.length
                            ? assigned.map((c) => c.name).join(' · ')
                            : tax.is_default ? 'Everything without a category tax' : '—'}
                        </td>
                        <td className="py-3 pr-3"><PricingPill inclusive={tax.is_inclusive} /></td>
                        <td className="py-3 pr-3">
                          {tax.is_default ? <span className="rounded-full bg-emerald-400/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-300">Default</span> : <span className="text-dash-tertiary">—</span>}
                        </td>
                        <td className="py-3 text-right">
                          <button type="button" onClick={() => openEditor(tax)} disabled={busy} title="Edit" className="rounded-lg border border-transparent p-1.5 text-dash-tertiary hover:border-dash-border hover:text-dash-cream disabled:opacity-50">
                            <Pencil size={15} />
                          </button>
                          <button type="button" onClick={() => deactivateTax(tax)} disabled={busy} title="Remove" className="ml-1 rounded-lg border border-transparent p-1.5 text-dash-tertiary hover:border-dash-border hover:text-red-300 disabled:opacity-50">
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-4 text-xs text-dash-tertiary">
            Changes propagate everywhere immediately — the POS, receipts, and reports all read from this list.
            Categories without a tax use the default.
          </p>
        </section>
      ) : (
        <section className="rounded-2xl border border-dash-border bg-dash-panel p-5">
          {splitItems.length === 0 ? (
            <div className="text-sm text-dash-secondary">
              <p>No split-priced items yet.</p>
              <p className="mt-2 text-xs text-dash-tertiary">
                Roll-up pricing splits one item’s price across sales categories — e.g. a $12 Jack &amp; Coke with
                $2.50 carved out to Food so that portion gets the food tax. Set it up on the item in the Menu tab.
              </p>
              <button type="button" onClick={goToMenu} className="mt-3 inline-flex items-center gap-1 rounded-lg border border-dash-border px-3 py-1.5 text-xs text-dash-secondary hover:text-dash-cream">
                Open Menu <ArrowUpRight size={13} />
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead>
                  <tr className="border-b border-dash-border text-left font-mono text-[10px] uppercase tracking-[0.08em] text-dash-tertiary">
                    <th className="py-2 pr-3">Item</th>
                    <th className="py-2 pr-3">Menu price</th>
                    <th className="py-2 pr-3">Allocation</th>
                    <th className="py-2 pr-3">Tax applied</th>
                    <th className="py-2 text-right">Edit</th>
                  </tr>
                </thead>
                <tbody>
                  {splitItems.map((item) => (
                    <tr key={item.item_id} className="border-b border-dash-border/50 text-dash-cream">
                      <td className="py-3 pr-3">
                        <span className="font-semibold">{item.item_name}</span>
                        {item.item_category ? <span className="block text-xs text-dash-tertiary">{item.item_category}</span> : null}
                      </td>
                      <td className="py-3 pr-3 tabular-nums">{money(item.item_price)}</td>
                      <td className="py-3 pr-3 text-dash-secondary">
                        {[`${money(item.remainder)} ${item.item_category || 'item category'}`,
                          ...item.allocations.map((a) => `${money(a.amount)} ${a.category_name}`)].join(' · ')}
                      </td>
                      <td className="py-3 pr-3 text-xs text-dash-secondary">
                        {[item.item_tax_name ? `${item.item_tax_name} on ${money(item.remainder)}` : null,
                          ...item.allocations.map((a) => (a.tax_name ? `${a.tax_name} on ${money(a.amount)}` : null))]
                          .filter(Boolean).join(' · ') || '—'}
                      </td>
                      <td className="py-3 text-right">
                        <button type="button" onClick={goToMenu} title="Edit on the item" className="rounded-lg border border-transparent p-1.5 text-dash-tertiary hover:border-dash-border hover:text-dash-cream">
                          <ArrowUpRight size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-4 text-xs text-dash-tertiary">
            Splits are edited on each item in the Menu tab (Price allocation section). This view is the audit surface:
            every portion reports under its own sales category, so liquor vs. food sales stay accurate.
          </p>
        </section>
      )}

      <Modal isOpen={Boolean(draft)} onClose={() => setDraft(null)} title={draft?.id ? 'Edit tax' : 'New tax'} size="md">
        {draft ? (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-dash-secondary">Name</span>
                <input
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="e.g. Liquor Tax"
                  className="w-full rounded-lg border border-dash-border bg-dash-panel px-3 py-2 text-sm text-dash-cream placeholder:text-dash-tertiary focus:border-dash-gold/60 focus:outline-none"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-dash-secondary">Rate (%)</span>
                <input
                  value={draft.rate}
                  onChange={(e) => setDraft({ ...draft, rate: e.target.value })}
                  inputMode="decimal"
                  placeholder="8.25"
                  className="w-full rounded-lg border border-dash-border bg-dash-panel px-3 py-2 text-sm tabular-nums text-dash-cream placeholder:text-dash-tertiary focus:border-dash-gold/60 focus:outline-none"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-dash-secondary">Tax scope</span>
                <select
                  value={draft.applies_to}
                  onChange={(e) => setDraft({ ...draft, applies_to: e.target.value })}
                  className="w-full rounded-lg border border-dash-border bg-dash-panel px-3 py-2 text-sm text-dash-cream focus:border-dash-gold/60 focus:outline-none"
                >
                  {taxAppliesToOptions(draft.applies_to).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
            </div>

            <div>
              <p className="text-sm font-semibold text-dash-cream">How this tax affects prices</p>
              <p className="mt-0.5 text-xs text-dash-tertiary">This changes how the menu price is treated everywhere — POS, receipts, and reports.</p>
              <div className="mt-2.5 space-y-2">
                <label className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3 ${draft.is_inclusive ? 'border-dash-gold/50 bg-dash-gold/10' : 'border-dash-border bg-dash-panel'}`}>
                  <input type="radio" name="tax-pricing" checked={draft.is_inclusive} onChange={() => setDraft({ ...draft, is_inclusive: true })} className="mt-0.5 accent-dash-gold" />
                  <span>
                    <span className="block text-sm font-semibold text-dash-cream">Included in the menu price</span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-dash-secondary">
                      The listed price is what the guest pays — like a $9 beer at the bar that’s simply $9.
                      Tax is backed out of the price.
                    </span>
                  </span>
                </label>
                <label className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3 ${!draft.is_inclusive ? 'border-dash-gold/50 bg-dash-gold/10' : 'border-dash-border bg-dash-panel'}`}>
                  <input type="radio" name="tax-pricing" checked={!draft.is_inclusive} onChange={() => setDraft({ ...draft, is_inclusive: false })} className="mt-0.5 accent-dash-gold" />
                  <span>
                    <span className="block text-sm font-semibold text-dash-cream">Added at checkout</span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-dash-secondary">
                      Tax is calculated on top of the menu price and shown as a separate line on the check.
                    </span>
                  </span>
                </label>
              </div>
              <PricingPreview ratePercent={draft.rate} inclusive={draft.is_inclusive} />
            </div>

            <div>
              <p className="text-sm font-semibold text-dash-cream">Applies to categories</p>
              <p className="mt-0.5 text-xs text-dash-tertiary">Every item in a checked category uses this tax. Unchecked categories keep their current tax.</p>
              {categories.length === 0 ? (
                <p className="mt-2 text-xs text-dash-tertiary">No menu categories yet.</p>
              ) : (
                <div className="mt-2.5 grid max-h-44 gap-1.5 overflow-y-auto sm:grid-cols-2">
                  {categories.map((category) => (
                    <label key={category.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-dash-border bg-dash-panel px-3 py-1.5 text-sm text-dash-cream">
                      <input
                        type="checkbox"
                        checked={draft.categoryIds.has(category.id)}
                        onChange={() => toggleDraftCategory(category.id)}
                        className="accent-dash-gold"
                      />
                      <span className="truncate">{category.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <label className="flex cursor-pointer items-center gap-2.5 text-sm text-dash-cream">
              <input type="checkbox" checked={draft.is_default} onChange={(e) => setDraft({ ...draft, is_default: e.target.checked })} className="accent-dash-gold" />
              Default tax — applies to anything without a category tax
            </label>

            <ModalFooter>
              <button type="button" onClick={() => setDraft(null)} className="rounded-lg border border-dash-border px-4 py-2 text-sm text-dash-secondary hover:text-dash-cream">
                Cancel
              </button>
              <button type="button" onClick={saveDraft} disabled={busy} className="rounded-lg bg-dash-gold px-5 py-2 text-sm font-semibold text-dash-base hover:brightness-105 disabled:opacity-50">
                {busy ? 'Saving…' : 'Save tax'}
              </button>
            </ModalFooter>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
