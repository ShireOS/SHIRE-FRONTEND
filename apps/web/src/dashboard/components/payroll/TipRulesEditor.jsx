import { useMemo, useState } from 'react'

// Redesigned Tip & Tipout Rules editor: a linear page that reads the way an
// owner explains the house policy — a plain-English summary, presets, tip
// pooling (pay-in %, payout method incl. declared role shares), tipouts as
// sentences (% of tips / total sales / a menu category's sales, own or
// restaurant-wide), a live math preview, and per-person exceptions.
//
// State model is unchanged: everything reads/writes the same settings object
// (role_tip_rules et al) that tipPayrollPayload() sends to the backend.

const NBSP = ' '
const WEEKDAYS = [
  { key: 'monday', label: 'Monday', short: 'Mon' },
  { key: 'tuesday', label: 'Tuesday', short: 'Tue' },
  { key: 'wednesday', label: 'Wednesday', short: 'Wed' },
  { key: 'thursday', label: 'Thursday', short: 'Thu' },
  { key: 'friday', label: 'Friday', short: 'Fri' },
  { key: 'saturday', label: 'Saturday', short: 'Sat' },
  { key: 'sunday', label: 'Sunday', short: 'Sun' },
]

function num(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function money(value) {
  return `$${num(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function pct(value) {
  return `${+num(value).toFixed(2)}%`
}

function labelFor(jobCodes, roleKey) {
  const code = (jobCodes || []).find(c => c.code === roleKey)
  return code?.label || roleKey
}

function isPooling(settings) {
  return Boolean(settings.tip_pooling_enabled) && settings.tip_distribution_mode !== 'individual'
}

function targetRolesForTipout(tipout) {
  if (!tipout?.headcount) return tipout?.target_role ? [tipout.target_role] : []
  return [...new Set((tipout.headcount.tiers || []).flatMap(tier =>
    (tier.allocations || []).filter(item => !item.unallocated && item.target_role).map(item => item.target_role),
  ))]
}

// ---------------------------------------------------------------------------
// Keep the primary basis control short. Category, scope, and allocation details
// live in the expandable row below it.
// ---------------------------------------------------------------------------

function compactBasis(tipout) {
  if (tipout.sales_category) return 'category'
  return tipout.basis === 'sales' ? 'sales' : 'tips'
}

function basisPhrase(tipout) {
  const house = tipout.basis_scope === 'restaurant'
  const cat = tipout.sales_category
  if (tipout.basis !== 'sales') {
    if (cat) return house ? `the restaurant's tips on ${cat} items` : `their tips on ${cat} items`
    return house ? "the restaurant's total tips" : 'their tips'
  }
  if (cat) return house ? `the restaurant's ${cat} sales` : `their ${cat} sales`
  return house ? "the restaurant's total sales" : 'their total sales'
}

// ---------------------------------------------------------------------------
// Plain-English policy summary — regenerated from the config on every change.
// If this sentence reads wrong, the config IS wrong.
// ---------------------------------------------------------------------------

function summarySentences(settings, jobCodes) {
  const rules = settings.role_tip_rules || []
  const sentences = []
  const pooling = isPooling(settings)

  if (pooling) {
    const payers = rules.filter(r => r.tip_eligible && r.contributes_to_pool)
    if (payers.length) {
      const parts = payers.map(r => {
        const p = r.pool_contribution_percent === '' ? 100 : num(r.pool_contribution_percent)
        return `${labelFor(jobCodes, r.role_key)} puts ${pct(p)} of tips into the pool${p < 100 ? ' and keeps the rest' : ''}`
      })
      sentences.push(parts.join('; ') + '.')
    }
    const mode = settings.tip_distribution_mode
    if (mode === 'role_shares') {
      const shared = rules.filter(r => num(r.pool_share_percent) > 0)
      if (shared.length) {
        sentences.push(`The pool pays ${shared.map(r => `${pct(r.pool_share_percent)} to ${labelFor(jobCodes, r.role_key)}`).join(' · ')}.`)
      } else {
        sentences.push('The pool pays out by role shares — set each role’s % below.')
      }
    } else if (mode === 'hours_based') {
      const weighted = rules.filter(r => r.tip_eligible && r.receives_from_pool && r.pool_points !== '' && num(r.pool_points) !== 1)
      sentences.push(weighted.length
        ? `The pool is split by hours worked (${weighted.map(r => `${labelFor(jobCodes, r.role_key)} ×${+num(r.pool_points).toFixed(2)}/hr`).join(', ')}).`
        : 'The pool is split by hours worked.')
    } else if (mode === 'sales_based') {
      sentences.push('The pool is split in proportion to each person’s sales.')
    } else if (mode === 'points_based' || mode === 'role_based') {
      sentences.push('The pool is split by role weights.')
    } else {
      sentences.push('The pool is split equally.')
    }
  } else {
    sentences.push('Everyone keeps the tips on their own checks.')
  }

  const tipoutParts = []
  rules.forEach(rule => {
    ;(rule.tipouts || []).forEach(t => {
      if (!(num(t.percent) > 0)) return
      if (t.headcount) {
        tipoutParts.push(`${labelFor(jobCodes, rule.role_key)} tips out ${pct(t.percent)} of ${basisPhrase(t)} using ${labelFor(jobCodes, t.headcount.driver_role)} headcount brackets`)
      } else if (t.target_role) {
        tipoutParts.push(`${labelFor(jobCodes, rule.role_key)} tips out ${pct(t.percent)} of ${basisPhrase(t)} to ${labelFor(jobCodes, t.target_role)}`)
      }
    })
  })
  if (tipoutParts.length) sentences.push(tipoutParts.join('; ') + '.')
  const weekdayOverrides = settings.weekday_tipout_overrides || {}
  const disabledDays = WEEKDAYS.filter(day => weekdayOverrides[day.key]?.mode === 'disabled').map(day => day.short)
  const customDays = WEEKDAYS.filter(day => weekdayOverrides[day.key]?.mode === 'custom').map(day => day.short)
  if (disabledDays.length) sentences.push(`No tipouts on ${disabledDays.join(', ')}.`)
  if (customDays.length) sentences.push(`Custom tipout rules apply on ${customDays.join(', ')}.`)
  return sentences
}

// ---------------------------------------------------------------------------
// Presets — canned rule sets applied client-side; nothing saves until "Save".
// Role matching is by common key names so they work with any job-code list.
// ---------------------------------------------------------------------------

function findRole(rules, ...names) {
  for (const name of names) {
    const hit = rules.find(r => r.role_key === name || r.role_key.includes(name))
    if (hit) return hit.role_key
  }
  return null
}

function buildPreset(kind, settings, jobCodes) {
  const rules = settings.role_tip_rules.map(r => ({
    ...r,
    contributes_to_pool: false,
    receives_from_pool: false,
    pool_contribution_percent: '100',
    pool_share_percent: '',
    tipouts: [],
  }))
  const byKey = new Map(rules.map(r => [r.role_key, r]))
  const server = findRole(rules, 'server', 'waiter')
  const busser = findRole(rules, 'busser', 'runner')
  const bar = findRole(rules, 'bartender', 'bar')
  const host = findRole(rules, 'host')
  const kitchen = findRole(rules, 'kitchen', 'chef', 'cook')
  const mark = (key, patch) => { if (key && byKey.has(key)) Object.assign(byKey.get(key), patch) }

  if (kind === 'keep_own_tipout') {
    const tipouts = []
    if (busser) tipouts.push({ target_role: busser, percent: '2', basis: 'sales', sales_category: '', basis_scope: 'own' })
    if (bar) tipouts.push({ target_role: bar, percent: '1', basis: 'sales', sales_category: '', basis_scope: 'own' })
    mark(server, { tip_eligible: true, tipouts })
    if (busser) mark(busser, { tip_eligible: true, tipout_split_basis: 'even' })
    if (bar) mark(bar, { tip_eligible: true, tipout_split_basis: 'even' })
    return { tip_distribution_mode: 'individual', tip_pooling_enabled: false, role_tip_rules: rules }
  }
  if (kind === 'pool_hours') {
    rules.forEach(rule => {
      const tipped = jobCodes.find(c => c.code === rule.role_key)?.is_tipped
      if (tipped) Object.assign(rule, { tip_eligible: true, contributes_to_pool: true, receives_from_pool: true })
    })
    return { tip_distribution_mode: 'hours_based', tip_pooling_enabled: true, role_tip_rules: rules }
  }
  if (kind === 'pool_role_shares') {
    mark(server, { tip_eligible: true, contributes_to_pool: true, receives_from_pool: false, pool_contribution_percent: '20' })
    const shares = [[busser, '40'], [bar, '30'], [host, '20'], [kitchen, '10']].filter(([k]) => k)
    shares.forEach(([key, share]) => mark(key, { tip_eligible: true, receives_from_pool: true, pool_share_percent: share }))
    return { tip_distribution_mode: 'role_shares', tip_pooling_enabled: true, role_tip_rules: rules }
  }
  // scratch
  return { tip_distribution_mode: 'individual', tip_pooling_enabled: false, role_tip_rules: rules }
}

const PRESETS = [
  { kind: 'keep_own_tipout', title: 'Keep own + tipouts', desc: 'Everyone keeps tips; servers tip out bussers & bar on sales.' },
  { kind: 'pool_role_shares', title: 'Pool, paid by role %', desc: 'Servers put 20% of tips in; pool pays 40/30/20/10 to support roles.' },
  { kind: 'pool_hours', title: 'Pool, paid by hours', desc: 'All tips into one pool, paid out by hours worked.' },
  { kind: 'scratch', title: 'Start from scratch', desc: 'No pooling, no tipouts.' },
]

// ---------------------------------------------------------------------------
// Sample-night simulator — a faithful client-side mirror of the backend
// engine (tipouts first and capped at tips, then pool contribution + payout)
// over a small fabricated cast built from the restaurant's own roles.
// ---------------------------------------------------------------------------

const SAMPLE_NAMES = ['Jane', 'Marco', 'Dee', 'Alix', 'Sam', 'Kai', 'Rio', 'Ana', 'Lee', 'Noa']

function buildSampleCast(settings, jobCodes) {
  const rules = settings.role_tip_rules || []
  const pooling = isPooling(settings)
  const referencedCategories = new Set()
  const targetRoles = new Set()
  rules.forEach(rule => (rule.tipouts || []).forEach(t => {
    if (num(t.percent) > 0) targetRolesForTipout(t).forEach(role => targetRoles.add(role))
    if (t.sales_category) referencedCategories.add(t.sales_category)
  }))

  const isEarner = rule =>
    (rule.tipouts || []).some(t => (t.target_role || t.headcount) && num(t.percent) > 0)
    || (pooling && rule.tip_eligible && rule.contributes_to_pool)
  const isReceiver = rule =>
    targetRoles.has(rule.role_key)
    || (pooling && rule.tip_eligible && rule.receives_from_pool && (settings.tip_distribution_mode !== 'role_shares' || num(rule.pool_share_percent) > 0))

  let involved = rules.filter(rule => isEarner(rule) || isReceiver(rule))
  if (!involved.length) involved = rules.filter(rule => rule.tip_eligible).slice(0, 2)
  involved = involved.slice(0, 6)

  const cats = [...referencedCategories]
  const cast = []
  let nameIndex = 0
  let doubledRole = null
  involved.forEach(rule => {
    const earner = isEarner(rule)
    // Give the first receive-only role two people so hours-vs-even splits show.
    const receiveOnly = !earner && isReceiver(rule)
    const copies = receiveOnly && !doubledRole ? 2 : 1
    if (copies === 2) doubledRole = rule.role_key
    for (let i = 0; i < copies; i += 1) {
      const salesByCategory = {}
      const tipsByCategory = {}
      if (earner) {
        // Sample night: $400 of sales per referenced category on a $200-tip
        // night; tips attribute pro-rata to the sales mix, like the backend.
        const salesTotal = 600 + cats.length * 400
        cats.forEach(cat => {
          salesByCategory[cat] = 400
          tipsByCategory[cat] = 200 * (400 / salesTotal)
        })
      }
      cast.push({
        name: SAMPLE_NAMES[nameIndex++ % SAMPLE_NAMES.length],
        role_key: rule.role_key,
        rule,
        hours: copies === 2 ? (i === 0 ? 6 : 2) : 8,
        tips: earner ? 200 : 0,
        sales: earner ? 600 + cats.length * 400 : 0,
        salesByCategory,
        tipsByCategory,
        tipoutPaid: 0,
        tipoutReceived: 0,
        contributed: 0,
        poolShare: 0,
      })
    }
  })
  return cast
}

function allocate(total, weights) {
  const sum = weights.reduce((s, w) => s + w, 0)
  if (!(total > 0) || !(sum > 0)) return weights.map(() => 0)
  return weights.map(w => (total * w) / sum)
}

export function simulateSampleNight(settings, jobCodes) {
  const cast = buildSampleCast(settings, jobCodes)
  if (!cast.length) return { cast, notes: [] }
  const byRole = new Map()
  cast.forEach(person => {
    if (!byRole.has(person.role_key)) byRole.set(person.role_key, [])
    byRole.get(person.role_key).push(person)
  })
  const houseSales = cast.reduce((s, p) => s + p.sales, 0)
  const houseTips = cast.reduce((s, p) => s + p.tips, 0)
  const houseByCategory = {}
  const houseTipsByCategory = {}
  cast.forEach(p => {
    Object.entries(p.salesByCategory).forEach(([cat, v]) => {
      houseByCategory[cat] = (houseByCategory[cat] || 0) + v
    })
    Object.entries(p.tipsByCategory).forEach(([cat, v]) => {
      houseTipsByCategory[cat] = (houseTipsByCategory[cat] || 0) + v
    })
  })
  const notes = []

  const splitWeights = members => {
    const basis = members[0]?.rule?.tipout_split_basis || 'even'
    if (basis === 'even' || basis === 'weights') return members.map(() => 1)
    const hours = members.map(m => m.hours)
    return hours.some(h => h > 0) ? hours : members.map(() => 1)
  }

  // --- tipouts (own + restaurant scope), capped at each payer's tips ---
  const catKey = value => String(value || '').trim().toLowerCase()
  const lookup = (map, category) => {
    const hit = Object.entries(map).find(([cat]) => catKey(cat) === catKey(category))
    return hit ? hit[1] : 0
  }
  const ownBasis = (person, t) => {
    if (t.basis !== 'sales') {
      return t.sales_category ? lookup(person.tipsByCategory, t.sales_category) : person.tips
    }
    return t.sales_category ? lookup(person.salesByCategory, t.sales_category) : person.sales
  }
  const houseBasis = t => {
    if (t.basis !== 'sales') {
      return t.sales_category ? lookup(houseTipsByCategory, t.sales_category) : houseTips
    }
    return t.sales_category ? lookup(houseByCategory, t.sales_category) : houseSales
  }

  const plannedByPerson = new Map()
  const plan = (person, targets, amount) => {
    if (!(amount > 0) || !targets?.length) return
    if (!plannedByPerson.has(person)) plannedByPerson.set(person, [])
    plannedByPerson.get(person).push({ targets, amount })
  }
  const previewWarnings = new Set()
  const destinationsFor = tipout => {
    if (!tipout.headcount) return [{ target_role: tipout.target_role, percent: 100, unallocated: false }]
    const count = (byRole.get(tipout.headcount.driver_role) || []).length
    const tier = (tipout.headcount.tiers || []).find(item => count >= num(item.min_count) && (item.max_count == null || count <= num(item.max_count)))
    return tier?.allocations || []
  }
  const planDestinations = (person, tipout, baseAmount) => {
    destinationsFor(tipout).forEach(destination => {
      const amount = baseAmount * num(destination.percent) / 100
      const targets = destination.unallocated ? [] : byRole.get(destination.target_role)
      if (!targets?.length) {
        const label = destination.unallocated ? 'Unallocated' : labelFor(jobCodes, destination.target_role)
        previewWarnings.add(`${money(amount)} is reserved for ${label} and will enter the SHIRE tip-out audit.`)
        return
      }
      plan(person, targets, amount)
    })
  }
  byRole.forEach((members, roleKey) => {
    const tipouts = (members[0].rule.tipouts || []).filter(t => (t.target_role || t.headcount) && num(t.percent) > 0)
    tipouts.forEach(t => {
      if (t.basis_scope === 'restaurant') {
        const amount = houseBasis(t) * num(t.percent) / 100
        const funding = allocate(amount, members.map(m => Math.max(0, m.tips)))
        members.forEach((m, i) => planDestinations(m, t, funding[i]))
      } else {
        members.forEach(m => planDestinations(m, t, ownBasis(m, t) * num(t.percent) / 100))
      }
    })
  })
  notes.push(...previewWarnings)
  plannedByPerson.forEach((planned, person) => {
    const total = planned.reduce((s, item) => s + item.amount, 0)
    const scale = total > person.tips && total > 0 ? person.tips / total : 1
    planned.forEach(({ targets, amount }) => {
      const paid = amount * scale
      person.tipoutPaid += paid
      const weights = splitWeights(targets)
      allocate(paid, weights).forEach((share, i) => { targets[i].tipoutReceived += share })
    })
    if (scale < 1) notes.push(`${person.name}’s tipouts were capped at their tips.`)
  })

  // --- pool: contribution then payout ---
  if (isPooling(settings)) {
    const mode = settings.tip_distribution_mode
    let pool = 0
    cast.forEach(person => {
      const rule = person.rule
      if (!rule.tip_eligible || !rule.contributes_to_pool) return
      const remaining = Math.max(0, person.tips - person.tipoutPaid)
      const share = rule.pool_contribution_percent === '' ? 100 : Math.min(100, Math.max(0, num(rule.pool_contribution_percent)))
      person.contributed = remaining * share / 100
      pool += person.contributed
    })
    const receivers = cast.filter(person => person.rule.tip_eligible && person.rule.receives_from_pool)
    if (pool > 0 && receivers.length) {
      if (mode === 'role_shares') {
        const roles = [...new Set(receivers.map(p => p.role_key))]
          .map(roleKey => ({ members: receivers.filter(p => p.role_key === roleKey), share: num(receivers.find(p => p.role_key === roleKey).rule.pool_share_percent) }))
          .filter(role => role.share > 0)
        if (roles.length) {
          allocate(pool, roles.map(role => role.share)).forEach((amount, i) => {
            const members = roles[i].members
            allocate(amount, splitWeights(members)).forEach((share, j) => { members[j].poolShare += share })
          })
        } else {
          allocate(pool, receivers.map(() => 1)).forEach((share, i) => { receivers[i].poolShare += share })
        }
      } else {
        const weightOf = person => {
          if (mode === 'hours_based') return person.hours * (person.rule.pool_points === '' ? 1 : num(person.rule.pool_points) || 1)
          if (mode === 'sales_based') return person.sales
          if (mode === 'points_based' || mode === 'role_based') return person.rule.pool_points === '' ? 1 : num(person.rule.pool_points)
          return 1
        }
        allocate(pool, receivers.map(weightOf)).forEach((share, i) => { receivers[i].poolShare += share })
      }
    }
  }

  cast.forEach(person => {
    person.final = person.tips - person.tipoutPaid - person.contributed + person.poolShare + person.tipoutReceived
  })
  return { cast, notes }
}

// ---------------------------------------------------------------------------
// Small UI primitives (match the dashboard glass style)
// ---------------------------------------------------------------------------

function Chip({ active, onClick, children, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        'rounded-full border px-3 py-1 text-xs transition disabled:opacity-40',
        active ? 'border-dash-gold/60 bg-dash-gold/10 text-dash-cream' : 'border-dash-border text-dash-secondary hover:border-dash-gold/40',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

function InlinePct({ value, onChange, placeholder = '0' }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-lg border border-dash-border bg-black/25 px-2 py-1">
      <input
        value={value}
        inputMode="decimal"
        onChange={event => onChange(event.target.value.replace(/[^0-9.]/g, '').slice(0, 6))}
        placeholder={placeholder}
        className="w-10 bg-transparent text-right text-sm text-dash-cream outline-none placeholder:text-dash-tertiary"
      />
      <span className="text-xs text-dash-tertiary">%</span>
    </span>
  )
}

function InlineSelect({ value, onChange, children, className = '' }) {
  return (
    <select
      value={value}
      onChange={onChange}
      className={`rounded-lg border border-dash-border bg-black/25 px-2 py-1.5 text-sm text-dash-cream outline-none focus:border-dash-gold/50 ${className}`}
    >
      {children}
    </select>
  )
}

function StepHeading({ title, hint }) {
  return (
    <div>
      <p className="text-base font-semibold text-dash-cream">{title}</p>
      {hint ? <p className="mt-1 text-xs text-dash-secondary">{hint}</p> : null}
    </div>
  )
}

function SectionCard({ children }) {
  return <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.02] p-5">{children}</div>
}

function defaultHeadcountPolicy(targetRole) {
  return {
    driver_role: targetRole,
    tiers: [{
      min_count: 0,
      max_count: null,
      allocations: [{ target_role: targetRole, unallocated: false, percent: '100' }],
    }],
  }
}

function HeadcountEditor({ headcount, sourceRole, jobCodes, onChange }) {
  if (!headcount) return null
  const roles = (jobCodes || []).filter(code => code.code !== sourceRole)
  const updateTier = (index, patch) => onChange({
    ...headcount,
    tiers: headcount.tiers.map((tier, current) => current === index ? { ...tier, ...patch } : tier),
  })
  const updateAllocation = (tierIndex, allocationIndex, patch) => {
    const tier = headcount.tiers[tierIndex]
    updateTier(tierIndex, {
      allocations: tier.allocations.map((allocation, current) => current === allocationIndex ? { ...allocation, ...patch } : allocation),
    })
  }
  const addTier = () => {
    const tiers = [...headcount.tiers]
    const last = tiers[tiers.length - 1]
    const nextMin = Math.max(Number(last?.min_count) || 0, Number(last?.max_count) || 0) + 1
    if (last?.max_count == null) tiers[tiers.length - 1] = { ...last, max_count: nextMin - 1 }
    tiers.push({
      min_count: nextMin,
      max_count: null,
      allocations: [{ target_role: headcount.driver_role, unallocated: false, percent: '100' }],
    })
    onChange({ ...headcount, tiers })
  }
  const removeTier = index => {
    const tiers = headcount.tiers.filter((_, current) => current !== index)
    if (!tiers.length) return
    tiers[tiers.length - 1] = { ...tiers[tiers.length - 1], max_count: null }
    onChange({ ...headcount, tiers })
  }
  const validation = (() => {
    const sorted = [...headcount.tiers].sort((a, b) => num(a.min_count) - num(b.min_count))
    if (!sorted.length || num(sorted[0].min_count) !== 0) return 'Brackets must start at 0.'
    let expected = 0
    for (let index = 0; index < sorted.length; index += 1) {
      const tier = sorted[index]
      if (num(tier.min_count) !== expected) return 'Brackets must be continuous without gaps or overlaps.'
      if (Math.abs(tier.allocations.reduce((sum, item) => sum + num(item.percent), 0) - 100) > 0.001) return 'Every bracket must allocate exactly 100%.'
      if (tier.max_count == null || tier.max_count === '') return index === sorted.length - 1 ? '' : 'Only the last bracket can be open-ended.'
      if (num(tier.max_count) < num(tier.min_count)) return 'A bracket maximum cannot be below its minimum.'
      expected = num(tier.max_count) + 1
    }
    return 'The final bracket must be open-ended.'
  })()

  return (
    <div className="mt-3 space-y-3 rounded-xl border border-dash-gold/30 bg-dash-gold/[0.04] p-3">
      <div className="flex flex-wrap items-center gap-2 text-sm text-dash-secondary">
        <span>Choose a bracket by counting</span>
        <InlineSelect value={headcount.driver_role} onChange={event => onChange({ ...headcount, driver_role: event.target.value })}>
          {roles.map(code => <option key={code.code} value={code.code}>{code.label}</option>)}
        </InlineSelect>
        <span>who worked positive hours in this tip window.</span>
      </div>
      <div className="space-y-2">
        {headcount.tiers.map((tier, tierIndex) => {
          const total = (tier.allocations || []).reduce((sum, item) => sum + num(item.percent), 0)
          return (
            <div key={tierIndex} className="space-y-2 rounded-lg border border-dash-border bg-black/20 p-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-dash-secondary">
                <span>When count is</span>
                <input value={tier.min_count} inputMode="numeric" onChange={event => updateTier(tierIndex, { min_count: event.target.value.replace(/\D/g, '') })} className="w-14 rounded border border-dash-border bg-black/25 px-2 py-1 text-dash-cream" />
                <span>to</span>
                <input value={tier.max_count == null ? '' : tier.max_count} inputMode="numeric" placeholder="∞" onChange={event => updateTier(tierIndex, { max_count: event.target.value === '' ? null : event.target.value.replace(/\D/g, '') })} className="w-14 rounded border border-dash-border bg-black/25 px-2 py-1 text-dash-cream placeholder:text-dash-tertiary" />
                <span className={`ml-auto font-semibold ${Math.abs(total - 100) < 0.001 ? 'text-emerald-300' : 'text-amber-300'}`}>{+total.toFixed(2)}%</span>
                {headcount.tiers.length > 1 ? <button type="button" onClick={() => removeTier(tierIndex)} className="text-red-300">Remove bracket</button> : null}
              </div>
              {(tier.allocations || []).map((allocation, allocationIndex) => (
                <div key={allocationIndex} className="flex flex-wrap items-center gap-2 text-sm">
                  <InlinePct value={allocation.percent} onChange={percent => updateAllocation(tierIndex, allocationIndex, { percent })} />
                  <span className="text-dash-secondary">to</span>
                  <InlineSelect
                    value={allocation.unallocated ? '__unallocated__' : allocation.target_role}
                    onChange={event => updateAllocation(tierIndex, allocationIndex, event.target.value === '__unallocated__'
                      ? { target_role: '', unallocated: true }
                      : { target_role: event.target.value, unallocated: false })}
                  >
                    <option value="">choose recipient…</option>
                    {roles.map(code => <option key={code.code} value={code.code}>{code.label}</option>)}
                    <option value="__unallocated__">Unallocated — send to audit</option>
                  </InlineSelect>
                  {tier.allocations.length > 1 ? (
                    <button type="button" onClick={() => updateTier(tierIndex, { allocations: tier.allocations.filter((_, current) => current !== allocationIndex) })} className="text-xs text-red-300">Remove</button>
                  ) : null}
                </div>
              ))}
              <button type="button" onClick={() => updateTier(tierIndex, { allocations: [...tier.allocations, { target_role: '', unallocated: false, percent: '' }] })} className="text-xs text-dash-gold">+ Add recipient</button>
            </div>
          )
        })}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" onClick={addTier} className="rounded-lg border border-dashed border-dash-gold/50 px-3 py-1.5 text-xs text-dash-gold">+ Add headcount bracket</button>
        {validation ? <span className="text-xs font-medium text-amber-300">{validation}</span> : <span className="text-xs font-medium text-emerald-300">Valid continuous brackets ✓</span>}
      </div>
    </div>
  )
}

function CustomWeightEditor({ rule, waiters, onChange }) {
  const [selectedId, setSelectedId] = useState('')
  const configured = rule.tipout_split_weights || []
  const byId = new Map((waiters || []).filter(waiter => waiter?.id).map(waiter => [String(waiter.id), waiter]))
  const available = (waiters || []).filter(waiter => waiter?.id && !configured.some(item => String(item.staff_id) === String(waiter.id)))
  return (
    <div className="mt-2 space-y-2 rounded-lg border border-dash-border bg-black/20 p-3">
      <p className="text-xs text-dash-secondary">Everyone defaults to weight 1. Add only employees who need a different positive weight.</p>
      {configured.map((item, index) => (
        <div key={item.staff_id} className="flex flex-wrap items-center gap-2 text-xs">
          <span className="min-w-[150px] text-dash-cream">{byId.get(String(item.staff_id))?.name || item.staff_id}</span>
          <span className="text-dash-tertiary">weight</span>
          <input value={item.weight} inputMode="decimal" onChange={event => onChange({ tipout_split_weights: configured.map((row, current) => current === index ? { ...row, weight: event.target.value.replace(/[^0-9.]/g, '').slice(0, 8) } : row) })} className="w-20 rounded border border-dash-border bg-black/25 px-2 py-1 text-dash-cream" />
          <button type="button" onClick={() => onChange({ tipout_split_weights: configured.filter((_, current) => current !== index) })} className="text-red-300">Remove</button>
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        <InlineSelect value={selectedId} onChange={event => setSelectedId(event.target.value)}>
          <option value="">choose employee…</option>
          {available.map(waiter => <option key={waiter.id} value={waiter.id}>{waiter.name || waiter.id}</option>)}
        </InlineSelect>
        <button type="button" disabled={!selectedId} onClick={() => { onChange({ tipout_split_weights: [...configured, { staff_id: selectedId, weight: '1' }] }); setSelectedId('') }} className="rounded-lg border border-dash-border px-2.5 py-1 text-xs text-dash-gold disabled:opacity-40">Add weight override</button>
      </div>
    </div>
  )
}

function copyScopedRules(rules) {
  return (rules || []).map(rule => ({
    ...rule,
    tipouts: (rule.tipouts || []).map(tipout => ({
      ...tipout,
      sales_category: '',
      basis_scope: 'own',
    })),
  }))
}

function ScopedTipoutEditor({ rules, jobCodes, waiters, onChange }) {
  const rows = []
  ;(rules || []).forEach((rule, ruleIndex) => {
    ;(rule.tipouts || []).forEach((tipout, tipoutIndex) => rows.push({ rule, ruleIndex, tipout, tipoutIndex }))
  })
  const update = (ruleIndex, tipoutIndex, patch) => {
    onChange(rules.map((rule, index) => index === ruleIndex ? {
      ...rule,
      tipouts: rule.tipouts.map((tipout, current) => current === tipoutIndex ? { ...tipout, ...patch } : tipout),
    } : rule))
  }
  const move = (ruleIndex, tipoutIndex, nextRole) => {
    const targetIndex = rules.findIndex(rule => rule.role_key === nextRole)
    if (targetIndex < 0 || targetIndex === ruleIndex) return
    const moving = rules[ruleIndex].tipouts[tipoutIndex]
    onChange(rules.map((rule, index) => {
      if (index === ruleIndex) return { ...rule, tipouts: rule.tipouts.filter((_, current) => current !== tipoutIndex) }
      if (index === targetIndex) return { ...rule, tipouts: [...(rule.tipouts || []), moving] }
      return rule
    }))
  }
  const remove = (ruleIndex, tipoutIndex) => onChange(rules.map((rule, index) => index === ruleIndex
    ? { ...rule, tipouts: rule.tipouts.filter((_, current) => current !== tipoutIndex) }
    : rule))
  const add = () => {
    const sourceIndex = rules.findIndex(rule => rule.tip_eligible)
    const index = sourceIndex >= 0 ? sourceIndex : 0
    if (index < 0) return
    onChange(rules.map((rule, current) => current === index ? {
      ...rule,
      tipouts: [...(rule.tipouts || []), { target_role: '', percent: '', basis: 'sales', sales_category: '', basis_scope: 'own' }],
    } : rule))
  }
  const receiverKeys = [...new Set(rows.flatMap(row => targetRolesForTipout(row.tipout)))]
  return (
    <div className="space-y-3">
      {rows.length ? rows.map(({ rule, ruleIndex, tipout, tipoutIndex }) => (
        <div key={`${rule.role_key}-${tipoutIndex}`} className="rounded-xl border border-dash-border bg-black/20 px-3 py-2.5 text-sm text-dash-secondary">
          <div className="flex flex-wrap items-center gap-2">
            <InlineSelect value={rule.role_key} onChange={event => move(ruleIndex, tipoutIndex, event.target.value)}>
              {jobCodes.map(code => <option key={code.code} value={code.code}>{code.label}</option>)}
            </InlineSelect>
            <span>tips out</span>
            <InlinePct value={tipout.percent} onChange={value => update(ruleIndex, tipoutIndex, { percent: value })} />
            <span>of this group’s</span>
            <InlineSelect value={tipout.basis} onChange={event => update(ruleIndex, tipoutIndex, { basis: event.target.value })}>
              <option value="sales">sales</option>
              <option value="tips">attributed tips</option>
            </InlineSelect>
            <span className="text-dash-gold">→</span>
            {tipout.headcount ? <span className="font-medium text-dash-gold">headcount brackets</span> : (
              <InlineSelect value={tipout.target_role} onChange={event => update(ruleIndex, tipoutIndex, { target_role: event.target.value })}>
                <option value="">choose recipient…</option>
                {jobCodes.filter(code => code.code !== rule.role_key).map(code => <option key={code.code} value={code.code}>{code.label}</option>)}
              </InlineSelect>
            )}
            <button type="button" onClick={() => {
              if (tipout.headcount) {
                const fallback = targetRolesForTipout(tipout)[0] || tipout.headcount.driver_role
                update(ruleIndex, tipoutIndex, { target_role: fallback, headcount: null })
              } else if (tipout.target_role) {
                update(ruleIndex, tipoutIndex, { target_role: '', headcount: defaultHeadcountPolicy(tipout.target_role) })
              }
            }} disabled={!tipout.headcount && !tipout.target_role} className="text-xs text-dash-gold disabled:opacity-40">
              {tipout.headcount ? 'Use one fixed role' : 'Allocate by headcount'}
            </button>
            <button type="button" onClick={() => remove(ruleIndex, tipoutIndex)} className="ml-auto px-1.5 text-dash-tertiary hover:text-red-300" aria-label="Remove scoped tipout">✕</button>
          </div>
          <HeadcountEditor headcount={tipout.headcount} sourceRole={rule.role_key} jobCodes={jobCodes} onChange={headcount => update(ruleIndex, tipoutIndex, { headcount })} />
        </div>
      )) : <p className="text-sm text-dash-tertiary">No tipout from this menu group.</p>}
      <button type="button" onClick={add} className="rounded-lg border border-dashed border-dash-gold/50 px-3 py-1.5 text-sm text-dash-gold hover:bg-dash-gold/10">+ Add tipout rule</button>
      {receiverKeys.length ? (
        <div className="space-y-2 text-xs text-dash-secondary">
          <span>Recipients split their share:</span>
          {receiverKeys.map(roleKey => {
            const index = rules.findIndex(rule => rule.role_key === roleKey)
            const rule = rules[index]
            if (!rule) return null
            const updateRule = patch => onChange(rules.map((row, current) => current === index ? { ...row, ...patch } : row))
            return (
              <div key={roleKey} className="rounded-lg border border-dash-border bg-black/15 p-2">
                <span className="mr-2 text-dash-cream">{labelFor(jobCodes, roleKey)}</span>
                <InlineSelect value={rule.tipout_split_basis || 'even'} onChange={event => updateRule({ tipout_split_basis: event.target.value })}>
                  <option value="hours">By role hours</option>
                  <option value="even">Evenly</option>
                  <option value="weights">Custom employee weights</option>
                </InlineSelect>
                {rule.tipout_split_basis === 'weights' ? <CustomWeightEditor rule={rule} waiters={waiters} onChange={updateRule} /> : null}
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

function cloneJson(value) {
  if (globalThis.structuredClone) return globalThis.structuredClone(value)
  return JSON.parse(JSON.stringify(value))
}

function WeekdayTipoutExceptions({ settings, jobCodes, waiters, onChange }) {
  const overrides = settings.weekday_tipout_overrides || {}
  const configuredDays = WEEKDAYS.filter(day => overrides[day.key])
  const [selectedDays, setSelectedDays] = useState([])
  const [mode, setMode] = useState('disabled')
  const poolAllowsWeekdays = !isPooling(settings) || settings.tip_pool_reset === 'day'

  const toggleDay = key => setSelectedDays(current => current.includes(key)
    ? current.filter(day => day !== key)
    : [...current, key])
  const updateOverride = (key, patch) => onChange({ ...overrides, [key]: { ...overrides[key], ...patch } })
  const inheritDefault = key => {
    const next = { ...overrides }
    delete next[key]
    onChange(next)
  }
  const apply = () => {
    if (!selectedDays.length || !poolAllowsWeekdays) return
    const next = { ...overrides }
    selectedDays.forEach(key => {
      if (mode === 'inherit') {
        delete next[key]
      } else if (mode === 'disabled') {
        next[key] = { mode: 'disabled' }
      } else {
        next[key] = {
          mode: 'custom',
          role_tip_rules: cloneJson(settings.role_tip_rules || []),
          category_tip_profiles: cloneJson(settings.category_tip_profiles || []),
        }
      }
    })
    onChange(next)
    setSelectedDays([])
  }
  const quickDisableWeekend = () => {
    if (!poolAllowsWeekdays) return
    onChange({ ...overrides, saturday: { mode: 'disabled' }, sunday: { mode: 'disabled' } })
  }

  return (
    <details className="rounded-xl border border-dash-border bg-black/15">
      <summary className="cursor-pointer list-none px-3 py-2.5 text-sm text-dash-cream marker:hidden">
        <span className="font-medium">Different rules by day</span>
        <span className="ml-2 text-xs text-dash-tertiary">
          {configuredDays.length
            ? configuredDays.map(day => `${day.short}: ${overrides[day.key].mode === 'disabled' ? 'none' : 'custom'}`).join(' · ')
            : 'Optional — every day currently uses the default above'}
        </span>
      </summary>
      <div className="space-y-4 border-t border-dash-border px-3 py-3">
        {!poolAllowsWeekdays ? (
          <p className="rounded-lg border border-amber-400/40 bg-amber-400/[0.06] px-3 py-2 text-xs text-amber-200">
            Weekday exceptions need a daily pool reset. Change “Pool resets every” to day first.
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          {WEEKDAYS.map(day => <Chip key={day.key} active={selectedDays.includes(day.key)} onClick={() => toggleDay(day.key)}>{day.short}</Chip>)}
          <InlineSelect value={mode} onChange={event => setMode(event.target.value)}>
            <option value="disabled">No tipouts</option>
            <option value="custom">Custom rules</option>
            <option value="inherit">Use default</option>
          </InlineSelect>
          <button type="button" disabled={!selectedDays.length || !poolAllowsWeekdays} onClick={apply} className="rounded-lg border border-dash-gold/60 bg-dash-gold/10 px-3 py-1.5 text-xs font-medium text-dash-gold disabled:opacity-40">Apply</button>
          <button type="button" disabled={!poolAllowsWeekdays} onClick={quickDisableWeekend} className="text-xs font-medium text-dash-gold disabled:opacity-40">No tipouts Sat–Sun</button>
        </div>
        {configuredDays.length ? (
          <div className="space-y-2">
            {configuredDays.map(day => {
              const override = overrides[day.key]
              if (override.mode === 'disabled') {
                return <div key={day.key} className="flex items-center justify-between rounded-lg border border-dash-border bg-white/[0.02] px-3 py-2 text-sm"><span className="text-dash-cream">{day.label} <span className="ml-1 text-dash-tertiary">No tipouts</span></span><button type="button" onClick={() => inheritDefault(day.key)} className="text-xs text-dash-gold">Use default</button></div>
              }
              return (
                <details key={day.key} className="rounded-lg border border-dash-border bg-white/[0.02]">
                  <summary className="cursor-pointer px-3 py-2 text-sm text-dash-cream">{day.label} <span className="ml-1 text-dash-tertiary">Custom rules</span></summary>
                  <div className="space-y-3 border-t border-dash-border p-3">
                    <p className="text-xs text-dash-tertiary">These rules replace only the default tipouts for {day.label}. Pool settings stay unchanged.</p>
                    <ScopedTipoutEditor rules={override.role_tip_rules || []} jobCodes={jobCodes} waiters={waiters} onChange={role_tip_rules => updateOverride(day.key, { role_tip_rules })} />
                    <button type="button" onClick={() => inheritDefault(day.key)} className="text-xs text-dash-gold">Remove exception and use default</button>
                  </div>
                </details>
              )
            })}
          </div>
        ) : null}
      </div>
    </details>
  )
}

function CategoryTipProfiles({ profiles, menuCategories, menuItems, defaultRules, jobCodes, waiters, onChange }) {
  const [selectedCategoryIds, setSelectedCategoryIds] = useState([])
  const [openId, setOpenId] = useState(null)
  const [activeOverrideId, setActiveOverrideId] = useState(null)
  const categories = (menuCategories || []).filter(category => category?.id && category?.is_active !== false)
  const categoryById = new Map(categories.map(category => [String(category.id), category]))
  const usedIds = new Set((profiles || []).flatMap(profile => profile.category_ids || []))
  const openProfile = (profiles || []).find(profile => profile.id === openId) || null
  const updateProfile = (patch) => onChange(profiles.map(profile => profile.id === openId ? { ...profile, ...patch } : profile))
  const matchingItems = openProfile ? (menuItems || []).filter(item => {
    const itemCategoryId = String(item.menu_category_id || item.category_id || '')
    if (openProfile.category_ids.includes(itemCategoryId)) return true
    const categoryNames = openProfile.category_ids.map(id => categoryById.get(String(id))?.name).filter(Boolean)
    return categoryNames.some(name => String(item.category || '').toLowerCase() === String(name).toLowerCase())
  }) : []
  const beginProfile = () => {
    if (!selectedCategoryIds.length) return
    const id = globalThis.crypto?.randomUUID?.() || `category_profile_${Date.now()}`
    const names = selectedCategoryIds.map(categoryId => categoryById.get(String(categoryId))?.name).filter(Boolean)
    const profile = {
      id,
      name: names.join(' + '),
      category_ids: selectedCategoryIds,
      category_names: names,
      role_tip_rules: copyScopedRules(defaultRules),
      item_overrides: [],
    }
    onChange([...(profiles || []), profile])
    setSelectedCategoryIds([])
    setOpenId(id)
  }
  const toggleOpenCategory = (categoryId) => {
    if (!openProfile) return
    const id = String(categoryId)
    if (usedIds.has(id) && !openProfile.category_ids.includes(id)) return
    const nextIds = openProfile.category_ids.includes(id) ? openProfile.category_ids.filter(value => value !== id) : [...openProfile.category_ids, id]
    if (!nextIds.length) return
    const nextCategoryNames = nextIds.map(value => categoryById.get(String(value))?.name).filter(Boolean)
    const nextCategoryNameKeys = new Set(nextCategoryNames.map(name => String(name).toLowerCase()))
    const nextItemOverrides = openProfile.item_overrides.filter(override => {
      const item = (menuItems || []).find(candidate => candidate.id === override.menu_item_id)
      if (!item) return false
      const itemCategoryId = String(item.menu_category_id || item.category_id || '')
      return nextIds.includes(itemCategoryId) || nextCategoryNameKeys.has(String(item.category || '').toLowerCase())
    })
    updateProfile({
      category_ids: nextIds,
      category_names: nextCategoryNames,
      name: nextCategoryNames.join(' + '),
      item_overrides: nextItemOverrides,
    })
    if (!nextItemOverrides.some(override => override.menu_item_id === activeOverrideId)) setActiveOverrideId(null)
  }
  const editOverride = (item) => {
    const existing = openProfile.item_overrides.find(override => override.menu_item_id === item.id)
    if (!existing) updateProfile({ item_overrides: [...openProfile.item_overrides, { menu_item_id: item.id, menu_item_name: item.name || '', role_tip_rules: copyScopedRules(openProfile.role_tip_rules) }] })
    setActiveOverrideId(item.id)
  }
  const activeOverride = openProfile?.item_overrides.find(override => override.menu_item_id === activeOverrideId) || null
  return (
    <SectionCard>
      <StepHeading title="Menu category rules" hint="Choose real POS categories. Items inherit their category rules; an item override wins over its category." />
      {!categories.length ? <p className="text-sm text-dash-tertiary">Add menu categories before creating category-specific tipouts.</p> : (
        <>
          <div className="flex flex-wrap gap-2">
            {categories.map(category => {
              const id = String(category.id)
              const used = usedIds.has(id)
              return <Chip key={id} active={selectedCategoryIds.includes(id) || used} disabled={used} onClick={() => setSelectedCategoryIds(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id])}>{category.name}{used ? ' · configured' : ''}</Chip>
            })}
          </div>
          <button type="button" disabled={!selectedCategoryIds.length} onClick={beginProfile} className="rounded-lg border border-dash-gold/60 bg-dash-gold/10 px-3.5 py-2 text-sm font-medium text-dash-gold disabled:opacity-40">Configure selected categories</button>
        </>
      )}
      {(profiles || []).length ? <div className="grid gap-2 md:grid-cols-2">{profiles.map(profile => {
        const names = profile.category_ids.map(id => categoryById.get(String(id))?.name).filter(Boolean)
        const ruleCount = profile.role_tip_rules.reduce((sum, rule) => sum + (rule.tipouts || []).length, 0)
        return <button key={profile.id} type="button" onClick={() => { setOpenId(profile.id); setActiveOverrideId(null) }} className="rounded-xl border border-dash-border bg-white/[0.03] p-4 text-left hover:border-dash-gold/50">
          <span className="block font-semibold text-dash-cream">{profile.name || names.join(' + ')}</span>
          <span className="mt-1 block text-xs text-dash-secondary">{names.join(', ')} · {ruleCount} rule{ruleCount === 1 ? '' : 's'} · {profile.item_overrides.length} item override{profile.item_overrides.length === 1 ? '' : 's'}</span>
        </button>
      })}</div> : null}
      {openProfile ? (
        <div className="fixed inset-0 z-[80] overflow-y-auto bg-black/80 p-4 backdrop-blur-sm sm:p-8">
          <div className="mx-auto max-w-5xl space-y-5 rounded-2xl border border-dash-border bg-dash-panel p-5 shadow-2xl sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div><p className="label-mono text-dash-gold">Category tipout configuration</p><h2 className="mt-1 text-xl font-semibold text-dash-cream">{openProfile.name}</h2><p className="mt-1 text-sm text-dash-secondary">Category rules replace the restaurant default. Item overrides replace these category rules.</p></div>
              <button type="button" onClick={() => { setOpenId(null); setActiveOverrideId(null) }} className="rounded-lg border border-dash-border px-3 py-1.5 text-sm text-dash-cream">Done</button>
            </div>
            <div className="space-y-2"><p className="text-xs font-medium uppercase tracking-[0.08em] text-dash-tertiary">Categories in this configuration</p><div className="flex flex-wrap gap-2">{categories.map(category => <Chip key={category.id} active={openProfile.category_ids.includes(String(category.id))} disabled={usedIds.has(String(category.id)) && !openProfile.category_ids.includes(String(category.id))} onClick={() => toggleOpenCategory(category.id)}>{category.name}</Chip>)}</div></div>
            <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.02] p-4"><StepHeading title="Category rules" hint="These rules apply to every item below unless that item has an override." /><ScopedTipoutEditor rules={openProfile.role_tip_rules} jobCodes={jobCodes} waiters={waiters} onChange={role_tip_rules => updateProfile({ role_tip_rules })} /></div>
            <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <StepHeading title="Items" hint="Override only the items that should calculate differently from their category." />
              {!matchingItems.length ? <p className="text-sm text-dash-tertiary">No active menu items are assigned to these categories.</p> : <div className="grid gap-2 sm:grid-cols-2">{matchingItems.map(item => {
                const overridden = openProfile.item_overrides.some(override => override.menu_item_id === item.id)
                return <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border border-dash-border bg-black/20 px-3 py-2"><span className="text-sm text-dash-cream">{item.name}</span><button type="button" onClick={() => editOverride(item)} className={`text-xs font-medium ${overridden ? 'text-dash-gold' : 'text-dash-secondary hover:text-dash-gold'}`}>{overridden ? 'Edit override' : 'Override'}</button></div>
              })}</div>}
            </div>
            {activeOverride ? <div className="space-y-3 rounded-xl border border-dash-gold/35 bg-dash-gold/[0.05] p-4"><div className="flex items-start justify-between gap-3"><StepHeading title={`${activeOverride.menu_item_name} override`} hint="This completely replaces the category rules for this item." /><button type="button" onClick={() => { updateProfile({ item_overrides: openProfile.item_overrides.filter(override => override.menu_item_id !== activeOverride.menu_item_id) }); setActiveOverrideId(null) }} className="text-xs text-red-300">Remove override</button></div><ScopedTipoutEditor rules={activeOverride.role_tip_rules} jobCodes={jobCodes} waiters={waiters} onChange={role_tip_rules => updateProfile({ item_overrides: openProfile.item_overrides.map(override => override.menu_item_id === activeOverride.menu_item_id ? { ...override, role_tip_rules } : override) })} /></div> : null}
            <div className="flex justify-between border-t border-dash-border pt-4"><button type="button" onClick={() => { onChange(profiles.filter(profile => profile.id !== openProfile.id)); setOpenId(null); setActiveOverrideId(null) }} className="text-sm text-red-300">Delete category configuration</button><button type="button" onClick={() => { setOpenId(null); setActiveOverrideId(null) }} className="rounded-lg border border-dash-gold bg-dash-gold/10 px-4 py-2 text-sm font-medium text-dash-gold">Done</button></div>
          </div>
        </div>
      ) : null}
    </SectionCard>
  )
}

// ---------------------------------------------------------------------------
// Main editor
// ---------------------------------------------------------------------------

export default function TipRulesEditor({
  settings,
  jobCodes,
  waiters,
  menuCategories,
  menuItems,
  readOnly = false,
  showAdvanced = true,
  onUpdateSettings,
  onUpdateRoleRule,
  onSaveWaiterOverride,
  onFetchRealPreview,
}) {
  const rules = settings.role_tip_rules || []
  const pooling = isPooling(settings)
  const mode = settings.tip_distribution_mode
  const advancedMode = mode === 'points_based' || mode === 'role_based' || mode === 'sales_based'
  const categories = useMemo(
    () => [...new Set((menuCategories || []).map(c => String(c?.name ?? c).trim()).filter(Boolean))],
    [menuCategories],
  )

  const summary = summarySentences(settings, jobCodes)
  const sample = useMemo(() => simulateSampleNight(settings, jobCodes), [settings, jobCodes])

  // ----- tipout list (flattened across roles) -----
  const tipoutRows = []
  rules.forEach((rule, ruleIndex) => {
    ;(rule.tipouts || []).forEach((tipout, tipoutIndex) => {
      tipoutRows.push({ rule, ruleIndex, tipout, tipoutIndex })
    })
  })

  const updateTipout = (ruleIndex, tipoutIndex, patch) => {
    const rule = rules[ruleIndex]
    onUpdateRoleRule(ruleIndex, {
      tipouts: rule.tipouts.map((item, i) => (i === tipoutIndex ? { ...item, ...patch } : item)),
    })
  }
  const removeTipout = (ruleIndex, tipoutIndex) => {
    onUpdateRoleRule(ruleIndex, { tipouts: rules[ruleIndex].tipouts.filter((_, i) => i !== tipoutIndex) })
  }
  const addTipout = () => {
    const fromIndex = rules.findIndex(r => r.tip_eligible)
    const index = fromIndex >= 0 ? fromIndex : 0
    if (!rules[index]) return
    onUpdateRoleRule(index, {
      tipouts: [...(rules[index].tipouts || []), { target_role: '', percent: '', basis: 'tips', sales_category: '', basis_scope: 'own' }],
    })
  }
  const moveTipout = (ruleIndex, tipoutIndex, nextRoleKey) => {
    const nextIndex = rules.findIndex(r => r.role_key === nextRoleKey)
    if (nextIndex < 0 || nextIndex === ruleIndex) return
    const tipout = rules[ruleIndex].tipouts[tipoutIndex]
    // Single settings update so both rule rows change atomically.
    onUpdateSettings({
      role_tip_rules: rules.map((rule, i) => {
        if (i === ruleIndex) return { ...rule, tipouts: rule.tipouts.filter((_, j) => j !== tipoutIndex) }
        if (i === nextIndex) return { ...rule, tipouts: [...(rule.tipouts || []), tipout] }
        return rule
      }),
    })
  }

  // ----- pool helpers -----
  const setPooling = enabled => {
    if (enabled) {
      onUpdateSettings({
        tip_pooling_enabled: true,
        tip_distribution_mode: mode === 'individual' ? 'role_shares' : mode,
      })
    } else {
      onUpdateSettings({ tip_pooling_enabled: false, tip_distribution_mode: 'individual' })
    }
  }
  const togglePayer = (index, rule) => {
    const next = !(rule.tip_eligible && rule.contributes_to_pool)
    onUpdateRoleRule(index, next ? { contributes_to_pool: true, tip_eligible: true } : { contributes_to_pool: false })
  }
  const toggleReceiver = (index, rule) => {
    const next = !(rule.tip_eligible && rule.receives_from_pool)
    onUpdateRoleRule(index, next ? { receives_from_pool: true, tip_eligible: true } : { receives_from_pool: false })
  }

  const payers = rules.map((rule, index) => ({ rule, index })).filter(({ rule }) => rule.tip_eligible && rule.contributes_to_pool)
  const receivers = rules.map((rule, index) => ({ rule, index })).filter(({ rule }) => rule.tip_eligible && rule.receives_from_pool)
  const shareTotal = receivers.reduce((s, { rule }) => s + num(rule.pool_share_percent), 0)

  // Roles that receive money (pool or tipout) — for the split-received control.
  const tipoutTargetKeys = new Set(tipoutRows.flatMap(({ tipout }) => targetRolesForTipout(tipout)))
  const splitControlRoles = rules
    .map((rule, index) => ({ rule, index }))
    .filter(({ rule }) => tipoutTargetKeys.has(rule.role_key) || (pooling && rule.tip_eligible && rule.receives_from_pool))

  // ----- exceptions -----
  const [addingException, setAddingException] = useState(false)
  const [exceptionWaiterId, setExceptionWaiterId] = useState('')
  const [exceptionBusy, setExceptionBusy] = useState('')
  const overrides = (waiters || []).filter(w => w?.tip_pool_eligible === false || (w?.tip_pool_weight != null && w.tip_pool_weight !== ''))
  const overrideIds = new Set(overrides.map(w => w.id))
  const saveOverride = async (waiterId, patch) => {
    setExceptionBusy(waiterId)
    try {
      await onSaveWaiterOverride(waiterId, patch)
    } finally {
      setExceptionBusy('')
    }
  }

  // ----- real-numbers preview -----
  const [realRows, setRealRows] = useState(null)
  const [realState, setRealState] = useState('idle') // idle | loading | ok | unavailable | empty
  const loadRealNumbers = async () => {
    if (realState === 'ok') { setRealRows(null); setRealState('idle'); return }
    setRealState('loading')
    try {
      const data = await onFetchRealPreview()
      const payouts = data?.payouts || []
      if (!payouts.length) { setRealRows(null); setRealState('empty'); return }
      setRealRows(data)
      setRealState('ok')
    } catch {
      setRealState('unavailable')
    }
  }

  const roleOptions = jobCodes.map(code => <option key={code.code} value={code.code}>{code.label}</option>)

  return (
    <fieldset disabled={readOnly} className="space-y-5">
      {/* ---- Plain-English summary ---- */}
      <div className="rounded-2xl border border-dash-gold/40 bg-dash-gold/[0.07] px-5 py-4">
        <p className="label-mono text-dash-gold">Current policy</p>
        <p className="mt-1.5 text-sm leading-relaxed text-dash-cream">
          {summary.map((sentence, i) => <span key={i}>{sentence}{' '}</span>)}
        </p>
      </div>

      {/* ---- Presets ---- */}
      <SectionCard>
        <StepHeading title="Templates" hint="Apply a starting point, then adjust the numbers." />
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {PRESETS.map(preset => (
            <button
              key={preset.kind}
              type="button"
              onClick={() => onUpdateSettings(buildPreset(preset.kind, settings, jobCodes))}
              className="rounded-xl border border-dash-border bg-white/[0.03] p-3 text-left transition hover:border-dash-gold/50"
            >
              <span className="block text-sm font-semibold text-dash-cream">{preset.title}</span>
              <span className="mt-1 block text-xs leading-relaxed text-dash-secondary">{preset.desc}</span>
            </button>
          ))}
        </div>
      </SectionCard>

      {/* ---- Pooling ---- */}
      <SectionCard>
        <StepHeading title="Tip pooling" hint="What happens to tips at the end of a shift?" />
        <div className="flex gap-2">
          <Chip active={!pooling} onClick={() => setPooling(false)}>Everyone keeps their own</Chip>
          <Chip active={pooling} onClick={() => setPooling(true)}>Tips go into a pool</Chip>
        </div>

        {pooling ? (
          <>
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-[0.08em] text-dash-tertiary">Pays in</p>
              <div className="flex flex-wrap gap-2">
                {rules.map((rule, index) => (
                  <Chip key={rule.role_key} active={rule.tip_eligible && rule.contributes_to_pool} onClick={() => togglePayer(index, rule)}>
                    {labelFor(jobCodes, rule.role_key)}
                  </Chip>
                ))}
              </div>
              {payers.map(({ rule, index }) => (
                <div key={rule.role_key} className="flex flex-wrap items-center gap-2 rounded-xl border border-dash-border bg-white/[0.03] px-3 py-2.5 text-sm text-dash-secondary">
                  <span className="font-semibold text-dash-cream">{labelFor(jobCodes, rule.role_key)}</span>
                  <span>puts</span>
                  <InlinePct
                    value={rule.pool_contribution_percent}
                    onChange={value => onUpdateRoleRule(index, { pool_contribution_percent: value })}
                    placeholder="100"
                  />
                  <span>of tips into the pool{num(rule.pool_contribution_percent || 100) < 100 ? ' and keeps the rest' : ''}</span>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-[0.08em] text-dash-tertiary">Pool payout</p>
              <div className="grid gap-2 sm:grid-cols-3">
                {[
                  { key: 'role_shares', title: 'By role %', desc: 'Each role gets a set % of the pool.' },
                  { key: 'hours_based', title: 'By hours worked', desc: 'Shares follow hours. Roles can be weighted per hour.' },
                  { key: 'pooled', title: 'Split equally', desc: 'Same amount for everyone in the pool.' },
                ].map(method => {
                  const selected = mode === method.key
                  return (
                    <button
                      key={method.key}
                      type="button"
                      onClick={() => onUpdateSettings({ tip_distribution_mode: method.key, tip_pooling_enabled: true })}
                      className={[
                        'rounded-xl border p-3 text-left transition',
                        selected ? 'border-dash-gold/60 bg-dash-gold/[0.08]' : 'border-dash-border bg-white/[0.03] hover:border-dash-gold/40',
                      ].join(' ')}
                    >
                      <span className={`block text-sm font-semibold ${selected ? 'text-dash-gold' : 'text-dash-cream'}`}>{method.title}</span>
                      <span className="mt-1 block text-xs leading-relaxed text-dash-secondary">{method.desc}</span>
                    </button>
                  )
                })}
              </div>
              {advancedMode ? (
                <p className="text-xs text-dash-gold/90">
                  Using an advanced payout ({mode === 'sales_based' ? 'by sales' : 'custom weights'}) — configured under Advanced below.
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-[0.08em] text-dash-tertiary">Receives</p>
              <div className="flex flex-wrap gap-2">
                {rules.map((rule, index) => (
                  <Chip key={rule.role_key} active={rule.tip_eligible && rule.receives_from_pool} onClick={() => toggleReceiver(index, rule)}>
                    {labelFor(jobCodes, rule.role_key)}
                  </Chip>
                ))}
              </div>
              {mode === 'hours_based' && receivers.length ? (
                <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dash-border bg-white/[0.03] px-3 py-2.5 text-sm">
                  <span className="text-dash-secondary">Weight per hour:</span>
                  {receivers.map(({ rule, index }) => (
                    <span key={rule.role_key} className="inline-flex items-center gap-1.5">
                      <span className="text-dash-cream">{labelFor(jobCodes, rule.role_key)}</span>
                      <span className="inline-flex items-center gap-1 rounded-lg border border-dash-border bg-black/25 px-2 py-1">
                        <span className="text-xs text-dash-tertiary">×</span>
                        <input
                          value={rule.pool_points}
                          inputMode="decimal"
                          onChange={event => onUpdateRoleRule(index, { pool_points: event.target.value.replace(/[^0-9.]/g, '').slice(0, 6) })}
                          placeholder="1"
                          className="w-10 bg-transparent text-right text-sm text-dash-cream outline-none placeholder:text-dash-tertiary"
                        />
                      </span>
                    </span>
                  ))}
                  <span className="text-xs text-dash-tertiary">1 = straight hours. Higher = a bigger share per hour.</span>
                </div>
              ) : null}
              {mode === 'role_shares' && receivers.length ? (
                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dash-border bg-white/[0.03] px-3 py-2.5 text-sm">
                  <span className="text-dash-secondary">Pool splits:</span>
                  {receivers.map(({ rule, index }) => (
                    <span key={rule.role_key} className="inline-flex items-center gap-1.5">
                      <span className="text-dash-cream">{labelFor(jobCodes, rule.role_key)}</span>
                      <InlinePct value={rule.pool_share_percent} onChange={value => onUpdateRoleRule(index, { pool_share_percent: value })} />
                    </span>
                  ))}
                  <span className={`ml-1 text-xs font-semibold tabular-nums ${Math.abs(shareTotal - 100) < 0.01 ? 'text-emerald-300' : 'text-amber-300'}`}>
                    ={NBSP}{+shareTotal.toFixed(2)}%{Math.abs(shareTotal - 100) < 0.01 ? ' ✓' : ' — rebalanced in proportion'}
                  </span>
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-dash-tertiary">
              <span>Pool resets every</span>
              <InlineSelect value={settings.tip_pool_reset} onChange={event => onUpdateSettings({ tip_pool_reset: event.target.value })}>
                <option value="shift">shift</option>
                <option value="day">day</option>
                <option value="pay_period">pay period</option>
              </InlineSelect>
            </div>
          </>
        ) : null}
      </SectionCard>

      {/* ---- Tipouts ---- */}
      <SectionCard>
        <StepHeading title="Tipouts" hint="The basis only sets how the amount is calculated — the money always comes out of the paying role's tips." />
        {tipoutRows.length === 0 ? (
          <p className="text-sm text-dash-tertiary">No tipouts yet — every role keeps its tips (minus any pool contribution above).</p>
        ) : null}
        <div className="space-y-2">
          {tipoutRows.map(({ rule, ruleIndex, tipout, tipoutIndex }) => (
            <div key={`${rule.role_key}-${tipoutIndex}`} className="rounded-xl border border-dash-border bg-white/[0.03] px-3 py-2.5 text-sm text-dash-secondary">
              <div className="flex flex-wrap items-center gap-2">
                <InlineSelect value={rule.role_key} onChange={event => moveTipout(ruleIndex, tipoutIndex, event.target.value)}>
                  {roleOptions}
                </InlineSelect>
                <span>tip out</span>
                <InlinePct value={tipout.percent} onChange={value => updateTipout(ruleIndex, tipoutIndex, { percent: value })} />
                <span>of</span>
                <InlineSelect value={compactBasis(tipout)} onChange={event => {
                  const next = event.target.value
                  if (next === 'tips') updateTipout(ruleIndex, tipoutIndex, { basis: 'tips', sales_category: '' })
                  if (next === 'sales') updateTipout(ruleIndex, tipoutIndex, { basis: 'sales', sales_category: '' })
                  if (next === 'category') updateTipout(ruleIndex, tipoutIndex, { basis: 'sales', sales_category: tipout.sales_category || categories[0] || '' })
                }} className="max-w-[190px]">
                  <option value="tips">their tips</option>
                  <option value="sales">their total sales</option>
                  <option value="category" disabled={!categories.length}>a menu category…</option>
                </InlineSelect>
                <span className="text-dash-gold">→</span>
                <span>to</span>
                {tipout.headcount ? <span className="font-semibold text-dash-gold">headcount brackets</span> : (
                  <InlineSelect value={tipout.target_role} onChange={event => updateTipout(ruleIndex, tipoutIndex, { target_role: event.target.value })}>
                    <option value="">choose role…</option>
                    {jobCodes.filter(code => code.code !== rule.role_key).map(code => <option key={code.code} value={code.code}>{code.label}</option>)}
                  </InlineSelect>
                )}
                <button type="button" onClick={() => removeTipout(ruleIndex, tipoutIndex)} className="ml-auto rounded px-1.5 text-dash-tertiary transition hover:text-red-300" aria-label="Remove tipout">✕</button>
              </div>
              <details className="mt-2 rounded-lg border border-dash-border/70 bg-black/10 px-2.5 py-2">
                <summary className="cursor-pointer text-xs font-medium text-dash-gold">Details</summary>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-dash-secondary">
                  <span>Calculate from</span>
                  <InlineSelect value={tipout.basis === 'sales' ? 'sales' : 'tips'} onChange={event => updateTipout(ruleIndex, tipoutIndex, { basis: event.target.value })}>
                    <option value="tips">tips</option>
                    <option value="sales">sales</option>
                  </InlineSelect>
                  <span>for</span>
                  <InlineSelect value={tipout.basis_scope === 'restaurant' ? 'restaurant' : 'own'} onChange={event => updateTipout(ruleIndex, tipoutIndex, { basis_scope: event.target.value })}>
                    <option value="own">each paying employee</option>
                    <option value="restaurant">the whole restaurant</option>
                  </InlineSelect>
                  <span>on</span>
                  <InlineSelect value={tipout.sales_category || ''} onChange={event => updateTipout(ruleIndex, tipoutIndex, { sales_category: event.target.value })}>
                    <option value="">all items</option>
                    {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </InlineSelect>
                  <button type="button" onClick={() => {
                    if (tipout.headcount) {
                      const fallback = targetRolesForTipout(tipout)[0] || tipout.headcount.driver_role
                      updateTipout(ruleIndex, tipoutIndex, { target_role: fallback, headcount: null })
                    } else if (tipout.target_role) {
                      updateTipout(ruleIndex, tipoutIndex, { target_role: '', headcount: defaultHeadcountPolicy(tipout.target_role) })
                    }
                  }} disabled={!tipout.headcount && !tipout.target_role} className="font-medium text-dash-gold disabled:opacity-40">
                    {tipout.headcount ? 'Use one fixed role' : 'Allocate by headcount'}
                  </button>
                </div>
                <HeadcountEditor headcount={tipout.headcount} sourceRole={rule.role_key} jobCodes={jobCodes} onChange={headcount => updateTipout(ruleIndex, tipoutIndex, { headcount })} />
              </details>
            </div>
          ))}
        </div>
        {(() => {
          // Same role, same category, both bases (X% of bar sales AND Y% of
          // bar-item tips) is almost always a misconfiguration — flag it.
          const doubled = []
          rules.forEach(rule => {
            const basesByCategory = {}
            ;(rule.tipouts || []).forEach(t => {
              if (!t.sales_category || !t.target_role || !(num(t.percent) > 0)) return
              const key = t.sales_category.toLowerCase()
              basesByCategory[key] = basesByCategory[key] || new Set()
              basesByCategory[key].add(t.basis)
            })
            Object.entries(basesByCategory).forEach(([cat, bases]) => {
              if (bases.size > 1) doubled.push(`${labelFor(jobCodes, rule.role_key)} on ${cat}`)
            })
          })
          if (!doubled.length) return null
          return (
            <p className="rounded-lg border border-amber-400/40 bg-amber-400/[0.06] px-3 py-2 text-xs text-amber-200">
              {doubled.join(', ')} has both a sales-based rule and a tip-share rule on the same category — usually you want one or the other.
            </p>
          )
        })()}
        <button type="button" onClick={addTipout} className="rounded-lg border border-dashed border-dash-gold/50 px-3.5 py-1.5 text-sm text-dash-gold hover:bg-dash-gold/10">
          + Add a tipout
        </button>

        {showAdvanced && splitControlRoles.length ? (
          <details className="rounded-xl border border-dash-border bg-black/15">
            <summary className="cursor-pointer px-3 py-2.5 text-sm text-dash-cream">Recipient split <span className="ml-1 text-xs text-dash-tertiary">Uniform / even by default</span></summary>
            <div className="space-y-2 border-t border-dash-border p-3 text-xs text-dash-tertiary">
            {splitControlRoles.map(({ rule, index }) => (
              <div key={rule.role_key} className="rounded-lg border border-dash-border bg-black/15 p-2">
                <span className="mr-2 text-dash-secondary">{labelFor(jobCodes, rule.role_key)}</span>
                <InlineSelect value={rule.tipout_split_basis || 'even'} onChange={event => onUpdateRoleRule(index, { tipout_split_basis: event.target.value })}>
                  <option value="hours">By role hours</option>
                  <option value="even">Uniform / even</option>
                  <option value="weights">Custom employee weights</option>
                </InlineSelect>
                {rule.tipout_split_basis === 'weights' ? <CustomWeightEditor rule={rule} waiters={waiters} onChange={patch => onUpdateRoleRule(index, patch)} /> : null}
              </div>
            ))}
            </div>
          </details>
        ) : null}
        {showAdvanced && <WeekdayTipoutExceptions settings={settings} jobCodes={jobCodes} waiters={waiters} onChange={weekday_tipout_overrides => onUpdateSettings({ weekday_tipout_overrides })} />}
      </SectionCard>

      {showAdvanced && <CategoryTipProfiles
        profiles={settings.category_tip_profiles || []}
        menuCategories={menuCategories}
        menuItems={menuItems}
        defaultRules={rules}
        jobCodes={jobCodes}
        waiters={waiters}
        onChange={category_tip_profiles => onUpdateSettings({ category_tip_profiles })}
      />}

      {/* ---- Check the math ---- */}
      <SectionCard>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <StepHeading title="Preview" hint={realState === 'ok' ? 'Yesterday’s real numbers through the saved rules.' : 'A sample night through the rules above. Updates as you edit.'} />
          <button
            type="button"
            onClick={loadRealNumbers}
            disabled={realState === 'loading'}
            className="rounded-lg border border-dash-border px-3 py-1.5 text-xs text-dash-secondary transition hover:border-dash-gold/50 hover:text-dash-cream disabled:opacity-50"
          >
            {realState === 'loading' ? 'Loading…' : realState === 'ok' ? 'Back to sample night' : 'Use yesterday’s real numbers'}
          </button>
        </div>
        {realState === 'unavailable' ? (
          <p className="rounded-lg border border-amber-400/40 bg-amber-400/[0.06] px-3 py-2 text-xs text-amber-200">
            The pay-run preview endpoint isn’t reachable on this server yet — showing the sample night instead.
          </p>
        ) : null}
        {realState === 'empty' ? (
          <p className="text-xs text-dash-tertiary">No tips or hours recorded yesterday — showing the sample night.</p>
        ) : null}
        {(() => {
          const rows = realState === 'ok' && realRows
            ? (realRows.payouts || []).map(p => ({
                name: p.staff_name || '—', role: p.role_key,
                detail: `${num(p.hours_worked).toFixed(1)}h · ${money(p.sales_total)} sales`,
                tips: num(p.tips_collected),
                out: num(p.tipout_paid) + num(p.contributed_to_pool),
                received: num(p.tipout_received) + num(p.pool_share),
                final: num(p.final_amount),
              }))
            : sample.cast.map(person => ({
                name: person.name, role: labelFor(jobCodes, person.role_key),
                detail: `${person.hours}h${person.sales ? ` · ${money(person.sales)} sales` : ''}`,
                tips: person.tips,
                out: person.tipoutPaid + person.contributed,
                received: person.tipoutReceived + person.poolShare,
                final: person.final,
              }))
          if (!rows.length) return <p className="text-sm text-dash-tertiary">Add a pool or a tipout above and the example appears here.</p>
          return (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-dash-border text-right font-mono text-[10px] uppercase tracking-[0.08em] text-dash-tertiary">
                    <th className="py-2 pr-3 text-left">Person</th>
                    <th className="py-2 pr-3">Collected</th>
                    <th className="py-2 pr-3">Pays out</th>
                    <th className="py-2 pr-3">Receives</th>
                    <th className="py-2 text-right">Takes home</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={i} className="border-b border-dash-border/50 text-right text-dash-cream">
                      <td className="py-2 pr-3 text-left">
                        <span className="font-medium">{row.name}</span>
                        <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.05em] text-dash-tertiary">{row.role} · {row.detail}</span>
                      </td>
                      <td className="py-2 pr-3 tabular-nums text-dash-secondary">{money(row.tips)}</td>
                      <td className="py-2 pr-3 tabular-nums text-red-300/90">{row.out > 0.004 ? `−${money(row.out)}` : '—'}</td>
                      <td className="py-2 pr-3 tabular-nums text-emerald-300/90">{row.received > 0.004 ? `+${money(row.received)}` : '—'}</td>
                      <td className="py-2 text-right font-semibold tabular-nums">{money(row.final)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        })()}
        {realState === 'ok' && realRows ? (() => {
          const matched = (realRows.payouts || []).flatMap(payout => payout.tipout_breakdown || []).filter(item => item.headcount_driver_role)
          const unique = [...new Map(matched.map(item => [`${item.scope_type}:${item.scope_id}:${item.target_role}:${item.headcount_tier_min}`, item])).values()]
          const pending = realRows.unallocated_tipouts || []
          if (!unique.length && !pending.length) return null
          return (
            <div className="space-y-1 rounded-lg border border-dash-border bg-black/15 p-3 text-xs text-dash-secondary">
              {unique.map((item, index) => (
                <p key={index}>
                  Counted <span className="font-semibold text-dash-cream">{item.headcount_count} {labelFor(jobCodes, item.headcount_driver_role)}</span>; matched {item.headcount_tier_min}{item.headcount_tier_max == null ? '+' : `–${item.headcount_tier_max}`} and sent {pct(item.allocation_percent)} to {labelFor(jobCodes, item.target_role)}.
                </p>
              ))}
              {pending.length ? <p className="font-medium text-amber-300">{money(realRows.totals?.total_unallocated_tipout)} is reserved in the SHIRE tip-out audit.</p> : null}
            </div>
          )
        })() : null}
        {realState !== 'ok' && sample.notes.length ? (
          <p className="text-xs text-dash-tertiary">{sample.notes.join(' ')}</p>
        ) : null}
      </SectionCard>

      {/* ---- Exceptions ---- */}
      <SectionCard>
        <StepHeading title="Exceptions" hint="Per-person overrides to the role rules. Saved immediately." />
        {overrides.length === 0 && !addingException ? (
          <p className="text-sm text-dash-tertiary">No exceptions — every person follows their role’s rules.</p>
        ) : null}
        <div className="space-y-2">
          {overrides.map(waiter => (
            <div key={waiter.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-dash-border bg-white/[0.03] px-3 py-2.5 text-sm">
              <div>
                <span className="font-medium text-dash-cream">{waiter.name}</span>
                <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.05em] text-dash-tertiary">{waiter.role || ''}</span>
              </div>
              <div className="ml-auto flex flex-wrap items-center gap-2">
                <Chip
                  active={waiter.tip_pool_eligible === false}
                  disabled={exceptionBusy === waiter.id}
                  onClick={() => saveOverride(waiter.id, { tip_pool_eligible: waiter.tip_pool_eligible === false ? null : false })}
                >
                  {waiter.tip_pool_eligible === false ? 'Not in tip pool' : 'In pool (role default)'}
                </Chip>
                <span className="inline-flex items-center gap-1.5 text-xs text-dash-secondary">
                  weight ×
                  <input
                    defaultValue={waiter.tip_pool_weight ?? ''}
                    inputMode="decimal"
                    placeholder="role"
                    disabled={exceptionBusy === waiter.id}
                    onBlur={event => {
                      const raw = event.target.value.trim()
                      const next = raw === '' ? null : Number(raw)
                      if (next !== null && !Number.isFinite(next)) return
                      if ((waiter.tip_pool_weight ?? null) !== next) void saveOverride(waiter.id, { tip_pool_weight: next })
                    }}
                    className="w-14 rounded-lg border border-dash-border bg-black/25 px-2 py-1 text-right text-sm text-dash-cream outline-none"
                  />
                </span>
                {exceptionBusy === waiter.id ? <span className="text-xs text-dash-tertiary">saving…</span> : null}
              </div>
            </div>
          ))}
        </div>
        {addingException ? (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <InlineSelect value={exceptionWaiterId} onChange={event => setExceptionWaiterId(event.target.value)}>
              <option value="">choose a person…</option>
              {(waiters || []).filter(w => w?.id && !overrideIds.has(w.id)).map(w => (
                <option key={w.id} value={w.id}>{w.name}{w.role ? ` · ${w.role}` : ''}</option>
              ))}
            </InlineSelect>
            <button
              type="button"
              disabled={!exceptionWaiterId || Boolean(exceptionBusy)}
              onClick={async () => {
                await saveOverride(exceptionWaiterId, { tip_pool_eligible: false })
                setExceptionWaiterId('')
                setAddingException(false)
              }}
              className="rounded-lg border border-dash-gold/60 bg-dash-gold/10 px-3 py-1.5 text-xs font-medium text-dash-gold disabled:opacity-40"
            >
              Exclude from pool
            </button>
            <button type="button" onClick={() => { setAddingException(false); setExceptionWaiterId('') }} className="text-xs text-dash-tertiary hover:text-dash-cream">Cancel</button>
          </div>
        ) : (
          <button type="button" onClick={() => setAddingException(true)} className="rounded-lg border border-dashed border-dash-gold/50 px-3.5 py-1.5 text-sm text-dash-gold hover:bg-dash-gold/10">
            + Add an exception
          </button>
        )}
      </SectionCard>

      {/* ---- Advanced ---- */}
      <details className="rounded-2xl border border-white/10 bg-white/[0.02]">
        <summary className="cursor-pointer select-none px-5 py-4 font-mono text-[11px] uppercase tracking-[0.12em] text-dash-secondary">
          Advanced
        </summary>
        <div className="space-y-5 px-5 pb-5">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-[0.08em] text-dash-tertiary">More payout methods</p>
            <div className="flex flex-wrap gap-2">
              <Chip active={mode === 'points_based' || mode === 'role_based'} onClick={() => onUpdateSettings({ tip_distribution_mode: 'points_based', tip_pooling_enabled: true })}>Custom weights (points)</Chip>
              <Chip active={mode === 'sales_based'} onClick={() => onUpdateSettings({ tip_distribution_mode: 'sales_based', tip_pooling_enabled: true })}>By each person’s sales</Chip>
            </div>
            {(mode === 'points_based' || mode === 'role_based') ? (
              <div className="flex flex-wrap gap-3 pt-1">
                {rules.filter(rule => rule.tip_eligible && rule.receives_from_pool).map(rule => {
                  const index = rules.indexOf(rule)
                  return (
                    <span key={rule.role_key} className="inline-flex items-center gap-1.5 text-xs text-dash-secondary">
                      {labelFor(jobCodes, rule.role_key)} points
                      <input
                        value={rule.pool_points}
                        inputMode="decimal"
                        onChange={event => onUpdateRoleRule(index, { pool_points: event.target.value.replace(/[^0-9.]/g, '').slice(0, 6) })}
                        placeholder="1"
                        className="w-14 rounded-lg border border-dash-border bg-black/25 px-2 py-1 text-right text-sm text-dash-cream outline-none"
                      />
                    </span>
                  )
                })}
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Chip active={settings.tipout_include_managers} onClick={() => onUpdateSettings({ tipout_include_managers: !settings.tipout_include_managers })}>Managers share in pools</Chip>
            <Chip active={settings.tipout_sales_includes_tax} onClick={() => onUpdateSettings({ tipout_sales_includes_tax: !settings.tipout_sales_includes_tax })}>Sales basis includes tax</Chip>
            <Chip active={settings.require_tipout_at_checkout} onClick={() => onUpdateSettings({ require_tipout_at_checkout: !settings.require_tipout_at_checkout })}>Require tipout at checkout</Chip>
          </div>
          <p className="text-xs leading-relaxed text-dash-tertiary">
            Rules saved by older versions of this page keep working — this editor reads and writes the same settings.
          </p>
        </div>
      </details>
    </fieldset>
  )
}
