import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Check, ChevronDown, Copy, Mail, RefreshCw, Search, Trash2 } from 'lucide-react'
import { useAuth } from '../../auth'
import { supabase } from '../../shared/lib/supabase'
import { backOfficeApi } from '../../shared/api/backOfficeApi'

const ACCOUNT_TYPES = [
  { value: 'owner', label: 'Owner' },
  { value: 'reseller', label: 'Reseller' },
  { value: 'admin', label: 'Admin' },
]

const displayName = (profile) =>
  [profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'Unnamed user'

function AssignmentEditor({ profile, restaurants, assignments, onToggle, busyRestaurantId }) {
  const assigned = assignments[profile.id] || new Set()

  return (
    <div className="border-t border-dash-border px-4 py-3">
      <p className="label-mono !text-[10px] normal-nums">
        Portfolio · {assigned.size} of {restaurants.length} stores
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {restaurants.map((restaurant) => {
          const isAssigned = assigned.has(restaurant.id)
          const isBusy = busyRestaurantId === `${profile.id}:${restaurant.id}`
          return (
            <button
              key={restaurant.id}
              type="button"
              disabled={isBusy}
              aria-pressed={isAssigned}
              onClick={() => onToggle(profile, restaurant, isAssigned)}
              className={[
                'flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors duration-100 active:scale-[0.98] disabled:opacity-50',
                isAssigned
                  ? 'border-shell-accent/60 bg-shell-accent/10 text-shell-accent'
                  : 'border-dash-border bg-[var(--glass-bg)] text-dash-secondary hover:border-dash-tertiary',
              ].join(' ')}
            >
              {isAssigned && <Check size={11} strokeWidth={3} aria-hidden="true" />}
              {restaurant.name || 'Untitled'}
            </button>
          )
        })}
        {restaurants.length === 0 && (
          <p className="text-xs text-dash-tertiary">No restaurants available to assign.</p>
        )}
      </div>
    </div>
  )
}

export default function UsersPage({ fallbackPath = '/enterprise/stores' }) {
  const auth = useAuth()
  const restaurants = auth.restaurant.restaurants || []

  const [profiles, setProfiles] = useState([])
  const [assignments, setAssignments] = useState({})
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busyKey, setBusyKey] = useState(null)
  const [invites, setInvites] = useState([])
  const [inviteDraft, setInviteDraft] = useState({ email: '', name: '', account_type: 'owner' })
  const [lastInvite, setLastInvite] = useState(null)

  useEffect(() => {
    if (auth.accountType !== 'admin') return
    let cancelled = false
    setLoading(true)
    Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('reseller_restaurants').select('reseller_id, restaurant_id').eq('status', 'active'),
      backOfficeApi.listPlatformInvites(),
    ])
      .then(([profileResult, assignmentResult, pendingInvites]) => {
        if (cancelled) return
        if (profileResult.error) throw profileResult.error
        if (assignmentResult.error) throw assignmentResult.error
        setProfiles(profileResult.data || [])
        const map = {}
        for (const row of assignmentResult.data || []) {
          if (!map[row.reseller_id]) map[row.reseller_id] = new Set()
          map[row.reseller_id].add(row.restaurant_id)
        }
        setAssignments(map)
        setInvites(pendingInvites)
        setError(null)
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError?.message || 'Could not load users.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [auth.accountType])

  const visibleProfiles = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return profiles
    return profiles.filter((profile) =>
      [profile.first_name, profile.last_name, profile.phone]
        .filter(Boolean)
        .some((field) => field.toLowerCase().includes(query))
    )
  }, [profiles, search])

  if (auth.accountType !== 'admin') {
    return <Navigate to={fallbackPath} replace />
  }

  const changeAccountType = async (profile, accountType) => {
    setBusyKey(profile.id)
    setError(null)
    try {
      const updated = await backOfficeApi.updatePlatformAccountType(profile.id, accountType)
      setProfiles((prev) => prev.map((item) => (item.id === profile.id ? { ...item, ...updated } : item)))
    } catch (updateError) {
      setError(updateError?.message || 'Could not update account type.')
    } finally {
      setBusyKey(null)
    }
  }

  const toggleAssignment = async (profile, restaurant, isAssigned) => {
    const key = `${profile.id}:${restaurant.id}`
    setBusyKey(key)
    setError(null)
    try {
      if (isAssigned) {
        const { error: deleteError } = await supabase
          .from('reseller_restaurants')
          .delete()
          .eq('reseller_id', profile.id)
          .eq('restaurant_id', restaurant.id)
        if (deleteError) throw deleteError
      } else {
        const { error: insertError } = await supabase
          .from('reseller_restaurants')
          .upsert(
            {
              reseller_id: profile.id,
              restaurant_id: restaurant.id,
              status: 'active',
              assigned_by: auth.user?.id,
            },
            { onConflict: 'reseller_id,restaurant_id' }
          )
        if (insertError) throw insertError
      }
      setAssignments((prev) => {
        const next = { ...prev }
        const set = new Set(next[profile.id] || [])
        if (isAssigned) set.delete(restaurant.id)
        else set.add(restaurant.id)
        next[profile.id] = set
        return next
      })
    } catch (assignError) {
      setError(assignError?.message || 'Could not update the assignment.')
    } finally {
      setBusyKey(null)
    }
  }

  const sendInvite = async () => {
    setBusyKey('invite')
    setError(null)
    try {
      const response = await backOfficeApi.invitePlatformAccount({
        email: inviteDraft.email.trim().toLowerCase(),
        name: inviteDraft.name.trim() || undefined,
        account_type: inviteDraft.account_type,
      })
      setInvites((prev) => [response.invitation, ...prev.filter((item) => item.email !== response.invitation.email)])
      setLastInvite(response)
      setInviteDraft((prev) => ({ ...prev, email: '', name: '' }))
    } catch (inviteError) {
      setError(inviteError?.message || 'Could not send the invitation.')
    } finally {
      setBusyKey(null)
    }
  }

  const resendInvite = async (invite) => {
    setBusyKey(`resend:${invite.id}`)
    try {
      setLastInvite(await backOfficeApi.resendInvite(invite.id))
    } catch (inviteError) {
      setError(inviteError?.message || 'Could not resend the invitation.')
    } finally {
      setBusyKey(null)
    }
  }

  const revokeInvite = async (invite) => {
    setBusyKey(`revoke:${invite.id}`)
    try {
      await backOfficeApi.revokeAccessInvite(invite.id)
      setInvites((prev) => prev.filter((item) => item.id !== invite.id))
    } catch (inviteError) {
      setError(inviteError?.message || 'Could not revoke the invitation.')
    } finally {
      setBusyKey(null)
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="label-mono">Enterprise</p>
        <h1 className="mt-1 text-4xl font-semibold tracking-tight text-dash-cream">Users</h1>
        <p className="mt-1 max-w-2xl text-sm text-dash-secondary">
          Promote accounts to reseller or admin, and assign stores to a reseller's portfolio.
        </p>
      </header>

      <section className="glass-card p-4">
        <div className="flex items-center gap-2">
          <Mail size={15} className="text-dash-tertiary" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-dash-cream">Invite an account</h2>
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-[1fr_1fr_150px_auto]">
          <input type="email" value={inviteDraft.email} onChange={(event) => setInviteDraft((prev) => ({ ...prev, email: event.target.value }))} placeholder="email@example.com" className="h-9 rounded-lg border border-dash-border bg-[var(--glass-bg)] px-3 text-sm text-dash-cream outline-none focus:border-shell-accent/60" />
          <input value={inviteDraft.name} onChange={(event) => setInviteDraft((prev) => ({ ...prev, name: event.target.value }))} placeholder="Name (optional)" className="h-9 rounded-lg border border-dash-border bg-[var(--glass-bg)] px-3 text-sm text-dash-cream outline-none focus:border-shell-accent/60" />
          <select value={inviteDraft.account_type} onChange={(event) => setInviteDraft((prev) => ({ ...prev, account_type: event.target.value }))} className="h-9 rounded-lg border border-dash-border bg-[var(--glass-bg)] px-2 text-sm text-dash-cream outline-none">
            {ACCOUNT_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
          </select>
          <button type="button" disabled={busyKey === 'invite'} onClick={() => void sendInvite()} className="h-9 rounded-lg bg-shell-cta px-4 text-sm font-semibold text-shell-cta-text disabled:opacity-50">{busyKey === 'invite' ? 'Sending' : 'Send invite'}</button>
        </div>
        {lastInvite?.accept_url && !lastInvite.email_sent && (
          <div className="mt-3 flex items-center gap-2 text-xs text-dash-warning">
            <span className="flex-1">Email is not configured. Share the generated invitation link.</span>
            <button type="button" title="Copy invitation link" aria-label="Copy invitation link" onClick={() => navigator.clipboard.writeText(lastInvite.accept_url)}><Copy size={14} /></button>
          </div>
        )}
        {invites.length > 0 && (
          <div className="mt-3 divide-y divide-dash-border border-t border-dash-border">
            {invites.map((invite) => (
              <div key={invite.id} className="flex items-center gap-2 py-2 text-xs">
                <span className="min-w-0 flex-1 truncate text-dash-secondary">{invite.email}</span>
                <span className="capitalize text-dash-tertiary">{String(invite.account_type || '').replace(/_/g, ' ')}</span>
                <button type="button" title="Resend invitation" aria-label="Resend invitation" onClick={() => void resendInvite(invite)} disabled={busyKey === `resend:${invite.id}`} className="text-dash-tertiary hover:text-dash-cream disabled:opacity-50"><RefreshCw size={13} /></button>
                <button type="button" title="Revoke invitation" aria-label="Revoke invitation" onClick={() => void revokeInvite(invite)} disabled={busyKey === `revoke:${invite.id}`} className="text-dash-danger/80 hover:text-dash-danger disabled:opacity-50"><Trash2 size={13} /></button>
              </div>
            ))}
          </div>
        )}
      </section>

      <label className="flex h-9 max-w-xs items-center gap-2 rounded-full glass-panel border border-dash-border px-3 focus-within:border-shell-accent/60">
        <Search size={14} strokeWidth={1.75} className="text-dash-tertiary" aria-hidden="true" />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search users"
          className="w-full bg-transparent text-sm text-dash-cream outline-none placeholder:text-dash-tertiary"
        />
      </label>

      {error && (
        <p className="rounded-lg border border-dash-danger/30 bg-dash-danger/10 px-3 py-2 text-sm text-dash-danger">
          {error} — run the reseller migration in Supabase if these tables don't exist yet.
        </p>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-dash-border border-t-shell-accent" />
        </div>
      ) : (
        <div className="space-y-2">
          {visibleProfiles.map((profile) => {
            const accountType = profile.account_type || 'owner'
            const isSuperuser = Boolean(profile.is_superuser)
            const isReseller = accountType === 'reseller'
            const isExpanded = expandedId === profile.id
            return (
              <section key={profile.id} className="glass-card rounded-2xl">
                <div className="flex flex-wrap items-center gap-3 p-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-shell-accent text-xs font-semibold text-shell-cta-text">
                    {(profile.first_name?.[0] || '?').toUpperCase()}
                    {(profile.last_name?.[0] || '').toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-dash-cream">{displayName(profile)}</p>
                    <p className="truncate label-mono !text-[10px] normal-nums">
                      {profile.phone || profile.id.slice(0, 8)}
                    </p>
                  </div>
                  <label className="relative flex h-9 items-center rounded-full border border-dash-border bg-[var(--glass-bg)] pl-3 pr-8">
                    <span className="sr-only">Account type</span>
                    <select
                      value={accountType}
                      disabled={busyKey === profile.id || profile.id === auth.user?.id || isSuperuser}
                      onChange={(event) => void changeAccountType(profile, event.target.value)}
                      className="appearance-none bg-transparent text-sm font-medium text-dash-cream outline-none disabled:opacity-60"
                    >
                      {ACCOUNT_TYPES.map((type) => (
                        <option key={type.value} value={type.value}>{type.label}</option>
                      ))}
                    </select>
                    <ChevronDown size={13} strokeWidth={1.75} className="pointer-events-none absolute right-3 text-dash-tertiary" aria-hidden="true" />
                  </label>
                  {isSuperuser && (
                    <span className="rounded-full border border-shell-accent/40 px-2.5 py-1 font-mono text-[10px] uppercase text-shell-accent">
                      Superuser
                    </span>
                  )}
                  {isReseller && (
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : profile.id)}
                      className="h-9 rounded-full border border-dash-border px-3.5 text-sm font-medium text-dash-secondary transition hover:border-shell-accent/60 hover:text-shell-accent active:scale-[0.98]"
                    >
                      {isExpanded ? 'Hide portfolio' : `Portfolio (${(assignments[profile.id] || new Set()).size})`}
                    </button>
                  )}
                </div>
                {isReseller && isExpanded && (
                  <AssignmentEditor
                    profile={profile}
                    restaurants={restaurants}
                    assignments={assignments}
                    onToggle={toggleAssignment}
                    busyRestaurantId={busyKey}
                  />
                )}
              </section>
            )
          })}
          {visibleProfiles.length === 0 && (
            <section className="glass-card rounded-2xl p-8 text-center">
              <p className="text-sm text-dash-secondary">No users match that search.</p>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
