import { useEffect, useState } from 'react'
import { BadgeDollarSign, Plus, ShieldCheck, Users } from 'lucide-react'
import { useAuth } from '../../auth'
import { supabase } from '../../shared/lib/supabase'
import { fetchWithSupabaseAuth } from '../../shared/query'

const money = (value) =>
  value === null || value === undefined || value === ''
    ? '—'
    : `$${Number(value).toFixed(2)}/hr`

function Pane({ icon: Icon, eyebrow, title, children, aside }) {
  return (
    <section className="glass-card rounded-2xl p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon size={15} strokeWidth={1.75} className="text-dash-tertiary" aria-hidden="true" />
          <p className="label-mono">{eyebrow}</p>
        </div>
        {aside}
      </div>
      <h2 className="mt-1 text-lg font-semibold tracking-tight text-dash-cream">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  )
}

function RateInput({ value, onCommit, placeholder }) {
  const [draft, setDraft] = useState(value ?? '')
  useEffect(() => setDraft(value ?? ''), [value])
  return (
    <input
      type="number"
      min="0"
      step="0.25"
      value={draft}
      placeholder={placeholder}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        if (String(draft) !== String(value ?? '')) onCommit(draft)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur()
      }}
      className="w-24 rounded-xl border border-dash-border bg-[var(--glass-bg)] px-2.5 py-1.5 font-mono text-xs tabular-nums text-dash-cream outline-none focus:border-shell-accent/60"
    />
  )
}

export default function TeamPage({ restaurantId }) {
  const auth = useAuth()
  const [waiters, setWaiters] = useState([])
  const [jobCodes, setJobCodes] = useState([])
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [newEmployee, setNewEmployee] = useState({ name: '', role: '', hourly_rate: '' })
  const [newGroup, setNewGroup] = useState({ label: '', rate: '' })

  useEffect(() => {
    if (!restaurantId) return
    let cancelled = false
    setLoading(true)
    Promise.all([
      fetchWithSupabaseAuth(`/restaurants/${restaurantId}/waiters?include_inactive=true`).catch(() => []),
      fetchWithSupabaseAuth(`/restaurants/${restaurantId}/job-codes`).catch(() => []),
      supabase
        .from('restaurant_members')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .then(({ data }) => data || [], () => []),
    ])
      .then(([waiterRows, codeRows, memberRows]) => {
        if (cancelled) return
        setWaiters(Array.isArray(waiterRows) ? waiterRows : [])
        setJobCodes(Array.isArray(codeRows) ? codeRows : [])
        setMembers(memberRows.filter((member) => member.role !== 'owner'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [restaurantId])

  const act = async (fn) => {
    setError(null)
    try {
      await fn()
    } catch (actionError) {
      setError(actionError?.message || 'That didn’t save — try again.')
    }
  }

  const addEmployee = () =>
    act(async () => {
      if (!newEmployee.name.trim()) throw new Error('Employee name is required.')
      const role = newEmployee.role || jobCodes[0]?.code || 'server'
      const jobCode = jobCodes.find((code) => code.code === role)
      const created = await fetchWithSupabaseAuth(`/restaurants/${restaurantId}/waiters`, {
        method: 'POST',
        body: JSON.stringify({
          name: newEmployee.name.trim(),
          role,
          job_code_id: jobCode?.id || null,
          hourly_rate: newEmployee.hourly_rate === '' ? null : Number(newEmployee.hourly_rate),
          pin: '1111',
        }),
      })
      setWaiters((prev) => [...prev, created])
      setNewEmployee({ name: '', role: '', hourly_rate: '' })
    })

  const patchWaiter = (waiterId, updates) =>
    act(async () => {
      const updated = await fetchWithSupabaseAuth(`/waiters/${waiterId}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      })
      setWaiters((prev) => prev.map((waiter) => (waiter.id === waiterId ? updated : waiter)))
    })

  const addGroup = () =>
    act(async () => {
      if (!newGroup.label.trim()) throw new Error('Group name is required.')
      const created = await fetchWithSupabaseAuth(`/restaurants/${restaurantId}/job-codes`, {
        method: 'POST',
        body: JSON.stringify({
          code: newGroup.label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_'),
          label: newGroup.label.trim(),
          permission_tier: 'normal',
          default_hourly_rate: newGroup.rate === '' ? 0 : Number(newGroup.rate),
          is_tipped: false,
          tipout_role: null,
          sort_order: jobCodes.length,
          is_active: true,
        }),
      })
      setJobCodes((prev) => [...prev, created])
      setNewGroup({ label: '', rate: '' })
    })

  const patchGroupRate = (jobCode, rate) =>
    act(async () => {
      const parsed = Number(rate)
      if (!Number.isFinite(parsed) || parsed < 0) throw new Error('Enter a valid hourly rate.')
      const saved = await fetchWithSupabaseAuth(`/manager/job-codes/${jobCode.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ default_hourly_rate: parsed.toFixed(2) }),
      })
      setJobCodes((prev) => prev.map((code) => (code.id === saved.id ? saved : code)))
    })

  const patchMember = (member, updates) =>
    act(async () => {
      const { error: updateError } = await supabase
        .from('restaurant_members')
        .update(updates)
        .eq('id', member.id)
      if (updateError) throw updateError
      setMembers((prev) => prev.map((item) => (item.id === member.id ? { ...item, ...updates } : item)))
    })

  const groupRate = (waiter) => {
    const byId = jobCodes.find((code) => code.id === waiter.job_code_id)
    const byRole = jobCodes.find((code) => code.code === (waiter.pos_role || waiter.role))
    return (byId || byRole)?.default_hourly_rate ?? null
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-dash-border border-t-shell-accent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {error && (
        <p className="rounded-xl border border-dash-danger/30 bg-dash-danger/10 px-3 py-2 text-sm text-dash-danger">
          {error}
        </p>
      )}

      <Pane icon={BadgeDollarSign} eyebrow="Pay groups" title="Set pay once per group">
        <div className="space-y-2">
          {jobCodes.map((code) => (
            <div key={code.id} className="flex flex-wrap items-center gap-3">
              <span className="min-w-[120px] text-sm font-semibold text-dash-cream">{code.label || code.code}</span>
              <span className="label-mono !text-[9px]">{code.is_tipped ? 'tipped' : 'untipped'}</span>
              <span className="ml-auto flex items-center gap-2">
                <RateInput
                  value={code.default_hourly_rate ?? ''}
                  onCommit={(rate) => void patchGroupRate(code, rate)}
                  placeholder="0.00"
                />
                <span className="text-xs text-dash-tertiary">/hr</span>
              </span>
            </div>
          ))}
          {jobCodes.length === 0 && (
            <p className="text-sm text-dash-tertiary">No pay groups yet — add the first one below.</p>
          )}
          <div className="flex flex-wrap items-center gap-2 border-t border-dash-border pt-3">
            <input
              value={newGroup.label}
              onChange={(event) => setNewGroup((prev) => ({ ...prev, label: event.target.value }))}
              placeholder="New group — e.g. Expo"
              className="min-w-[160px] flex-1 rounded-xl border border-dash-border bg-[var(--glass-bg)] px-3 py-2 text-sm text-dash-cream outline-none placeholder:text-dash-tertiary focus:border-shell-accent/60"
            />
            <input
              type="number"
              min="0"
              step="0.25"
              value={newGroup.rate}
              onChange={(event) => setNewGroup((prev) => ({ ...prev, rate: event.target.value }))}
              placeholder="Rate"
              className="w-24 rounded-xl border border-dash-border bg-[var(--glass-bg)] px-3 py-2 font-mono text-sm tabular-nums text-dash-cream outline-none placeholder:text-dash-tertiary focus:border-shell-accent/60"
            />
            <button
              type="button"
              onClick={() => void addGroup()}
              className="flex min-h-[38px] items-center gap-1 rounded-xl bg-shell-cta px-3 text-sm font-semibold text-shell-cta-text transition hover:opacity-90"
            >
              <Plus size={14} strokeWidth={2} aria-hidden="true" />
              Add group
            </button>
          </div>
        </div>
      </Pane>

      <Pane icon={Users} eyebrow="Employees" title="Roles & individual pay">
        <div className="space-y-2">
          {waiters.map((waiter) => {
            const override = waiter.hourly_rate
            const inherited = groupRate(waiter)
            return (
              <div key={waiter.id} className="flex flex-wrap items-center gap-3">
                <span className={`min-w-[130px] text-sm font-semibold ${waiter.is_active === false ? 'text-dash-tertiary line-through' : 'text-dash-cream'}`}>
                  {waiter.name}
                </span>
                <select
                  value={waiter.pos_role || waiter.role || ''}
                  onChange={(event) => {
                    const role = event.target.value
                    const jobCode = jobCodes.find((code) => code.code === role)
                    void patchWaiter(waiter.id, { role, job_code_id: jobCode?.id || null })
                  }}
                  className="rounded-xl border border-dash-border bg-[var(--glass-bg)] px-2.5 py-1.5 text-xs font-semibold text-dash-secondary outline-none"
                >
                  {jobCodes.map((code) => (
                    <option key={code.id} value={code.code}>{code.label || code.code}</option>
                  ))}
                  {jobCodes.every((code) => code.code !== (waiter.pos_role || waiter.role)) && (
                    <option value={waiter.pos_role || waiter.role || ''}>{waiter.pos_role || waiter.role || 'unassigned'}</option>
                  )}
                </select>
                <span className="ml-auto flex items-center gap-2">
                  <RateInput
                    value={override ?? ''}
                    onCommit={(rate) =>
                      void patchWaiter(waiter.id, { hourly_rate: rate === '' ? null : Number(rate) })
                    }
                    placeholder={inherited != null ? Number(inherited).toFixed(2) : '0.00'}
                  />
                  <span className="w-24 text-xs text-dash-tertiary">
                    {override != null && override !== '' ? 'override' : inherited != null ? `group ${money(inherited)}` : 'no rate'}
                  </span>
                  <button
                    type="button"
                    onClick={() => void patchWaiter(waiter.id, { is_active: waiter.is_active === false })}
                    className="text-xs font-semibold text-dash-tertiary transition hover:text-dash-secondary"
                  >
                    {waiter.is_active === false ? 'Reactivate' : 'Deactivate'}
                  </button>
                </span>
              </div>
            )
          })}
          {waiters.length === 0 && <p className="text-sm text-dash-tertiary">No employees yet.</p>}
          <div className="flex flex-wrap items-center gap-2 border-t border-dash-border pt-3">
            <input
              value={newEmployee.name}
              onChange={(event) => setNewEmployee((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="New employee name"
              className="min-w-[160px] flex-1 rounded-xl border border-dash-border bg-[var(--glass-bg)] px-3 py-2 text-sm text-dash-cream outline-none placeholder:text-dash-tertiary focus:border-shell-accent/60"
            />
            <select
              value={newEmployee.role || jobCodes[0]?.code || ''}
              onChange={(event) => setNewEmployee((prev) => ({ ...prev, role: event.target.value }))}
              className="rounded-xl border border-dash-border bg-[var(--glass-bg)] px-2.5 py-2 text-xs font-semibold text-dash-secondary outline-none"
            >
              {jobCodes.map((code) => (
                <option key={code.id} value={code.code}>{code.label || code.code}</option>
              ))}
              {jobCodes.length === 0 && <option value="server">Server</option>}
            </select>
            <button
              type="button"
              onClick={() => void addEmployee()}
              className="flex min-h-[38px] items-center gap-1 rounded-xl bg-shell-cta px-3 text-sm font-semibold text-shell-cta-text transition hover:opacity-90"
            >
              <Plus size={14} strokeWidth={2} aria-hidden="true" />
              Add
            </button>
          </div>
        </div>
      </Pane>

      <Pane
        icon={ShieldCheck}
        eyebrow="Authorized members"
        title="Who can open this dashboard"
        aside={
          <span
            title="Member invites — coming soon"
            className="rounded-full border border-dash-border px-2 py-0.5 font-mono text-[9px] uppercase tracking-eyebrow text-dash-tertiary"
          >
            Invite · soon
          </span>
        }
      >
        <div className="space-y-2">
          {members.map((member) => (
            <div key={member.id} className="flex flex-wrap items-center gap-3">
              <span className="min-w-[130px] font-mono text-xs text-dash-cream">
                {member.user_id === auth.user?.id ? 'You' : member.user_id.slice(0, 8)}
              </span>
              <select
                value={member.role}
                onChange={(event) => void patchMember(member, { role: event.target.value })}
                className="rounded-xl border border-dash-border bg-[var(--glass-bg)] px-2.5 py-1.5 text-xs font-semibold text-dash-secondary outline-none"
              >
                {['manager', 'server', 'host', 'kitchen'].map((role) => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
              <span className="ml-auto flex items-center gap-3">
                <span className={`label-mono !text-[9px] ${member.status === 'active' ? '!text-dash-success' : ''}`}>
                  {member.status || 'pending'}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    void patchMember(member, { status: member.status === 'active' ? 'deactivated' : 'active' })
                  }
                  className="text-xs font-semibold text-dash-tertiary transition hover:text-dash-secondary"
                >
                  {member.status === 'active' ? 'Deactivate' : 'Activate'}
                </button>
              </span>
            </div>
          ))}
          {members.length === 0 && (
            <p className="text-sm text-dash-tertiary">
              No additional members — only the owner can open this dashboard today. Member invites land with the invite flow.
            </p>
          )}
        </div>
      </Pane>
    </div>
  )
}
