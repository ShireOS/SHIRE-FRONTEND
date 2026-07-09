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

// ---------------------------------------------------------------------------
// Basis encoding for the tipout sentence dropdown.
// value = `${basis}|${scope}|${encodeURIComponent(category)}`
// ---------------------------------------------------------------------------

function encodeBasis(tipout) {
  return `${tipout.basis === 'sales' ? 'sales' : 'tips'}|${tipout.basis_scope === 'restaurant' ? 'restaurant' : 'own'}|${encodeURIComponent(tipout.sales_category || '')}`
}

function decodeBasis(value) {
  const [basis, scope, category] = String(value).split('|')
  return {
    basis: basis === 'sales' ? 'sales' : 'tips',
    basis_scope: scope === 'restaurant' ? 'restaurant' : 'own',
    sales_category: decodeURIComponent(category || ''),
  }
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
      if (!t.target_role || !(num(t.percent) > 0)) return
      tipoutParts.push(`${labelFor(jobCodes, rule.role_key)} tips out ${pct(t.percent)} of ${basisPhrase(t)} to ${labelFor(jobCodes, t.target_role)}`)
    })
  })
  if (tipoutParts.length) sentences.push(tipoutParts.join('; ') + '.')
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
    if (busser) mark(busser, { tip_eligible: true })
    if (bar) mark(bar, { tip_eligible: true })
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
    if (t.target_role && num(t.percent) > 0) targetRoles.add(t.target_role)
    if (t.sales_category) referencedCategories.add(t.sales_category)
  }))

  const isEarner = rule =>
    (rule.tipouts || []).some(t => t.target_role && num(t.percent) > 0)
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
    if ((members[0]?.rule?.tipout_split_basis || 'hours') === 'even') return members.map(() => 1)
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
  byRole.forEach((members, roleKey) => {
    const tipouts = (members[0].rule.tipouts || []).filter(t => t.target_role && t.target_role !== roleKey && num(t.percent) > 0)
    tipouts.forEach(t => {
      const targets = byRole.get(t.target_role)
      if (!targets) return
      if (t.basis_scope === 'restaurant') {
        const amount = houseBasis(t) * num(t.percent) / 100
        const funding = allocate(amount, members.map(m => Math.max(0, m.tips)))
        members.forEach((m, i) => plan(m, targets, funding[i]))
      } else {
        members.forEach(m => plan(m, targets, ownBasis(m, t) * num(t.percent) / 100))
      }
    })
  })
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

// ---------------------------------------------------------------------------
// Main editor
// ---------------------------------------------------------------------------

export default function TipRulesEditor({
  settings,
  jobCodes,
  waiters,
  menuCategories,
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
  const tipoutTargetKeys = new Set(tipoutRows.map(({ tipout }) => tipout.target_role).filter(Boolean))
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
      if (!payouts.length) { setRealRows([]); setRealState('empty'); return }
      setRealRows(payouts)
      setRealState('ok')
    } catch {
      setRealState('unavailable')
    }
  }

  const roleOptions = jobCodes.map(code => <option key={code.code} value={code.code}>{code.label}</option>)

  return (
    <div className="space-y-5">
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
            <div key={`${rule.role_key}-${tipoutIndex}`} className="flex flex-wrap items-center gap-2 rounded-xl border border-dash-border bg-white/[0.03] px-3 py-2.5 text-sm text-dash-secondary">
              <InlineSelect value={rule.role_key} onChange={event => moveTipout(ruleIndex, tipoutIndex, event.target.value)}>
                {roleOptions}
              </InlineSelect>
              <span>tip out</span>
              <InlinePct value={tipout.percent} onChange={value => updateTipout(ruleIndex, tipoutIndex, { percent: value })} />
              <span>of</span>
              <InlineSelect value={encodeBasis(tipout)} onChange={event => updateTipout(ruleIndex, tipoutIndex, decodeBasis(event.target.value))} className="max-w-[240px]">
                <optgroup label="Each person's own numbers">
                  <option value="tips|own|">their tips</option>
                  {categories.map(cat => (
                    <option key={`own-t-${cat}`} value={`tips|own|${encodeURIComponent(cat)}`}>their tips on {cat} items</option>
                  ))}
                  <option value="sales|own|">their total sales</option>
                  {categories.map(cat => (
                    <option key={`own-s-${cat}`} value={`sales|own|${encodeURIComponent(cat)}`}>their {cat} sales</option>
                  ))}
                </optgroup>
                <optgroup label="Whole restaurant">
                  <option value="sales|restaurant|">restaurant total sales</option>
                  {categories.map(cat => (
                    <option key={`rest-${cat}`} value={`sales|restaurant|${encodeURIComponent(cat)}`}>restaurant {cat} sales</option>
                  ))}
                  <option value="tips|restaurant|">restaurant total tips</option>
                </optgroup>
              </InlineSelect>
              <span className="text-dash-gold">→</span>
              <span>to</span>
              <InlineSelect
                value={tipout.target_role}
                onChange={event => updateTipout(ruleIndex, tipoutIndex, { target_role: event.target.value })}
              >
                <option value="">choose role…</option>
                {jobCodes.filter(code => code.code !== rule.role_key).map(code => <option key={code.code} value={code.code}>{code.label}</option>)}
              </InlineSelect>
              <button
                type="button"
                onClick={() => removeTipout(ruleIndex, tipoutIndex)}
                className="ml-auto rounded px-1.5 text-dash-tertiary transition hover:text-red-300"
                aria-label="Remove tipout"
              >
                ✕
              </button>
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

        {splitControlRoles.length ? (
          <p className="text-xs leading-relaxed text-dash-tertiary">
            {splitControlRoles.map(({ rule, index }, i) => (
              <span key={rule.role_key}>
                {i > 0 ? ' · ' : ''}
                <span className="text-dash-secondary">{labelFor(jobCodes, rule.role_key)}</span> split what they receive{' '}
                <button
                  type="button"
                  onClick={() => onUpdateRoleRule(index, { tipout_split_basis: rule.tipout_split_basis === 'even' ? 'hours' : 'even' })}
                  className="font-semibold text-dash-gold underline decoration-dotted underline-offset-2"
                >
                  {rule.tipout_split_basis === 'even' ? 'evenly' : 'by hours worked'}
                </button>
              </span>
            ))}
          </p>
        ) : null}
      </SectionCard>

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
            ? realRows.map(p => ({
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
    </div>
  )
}
