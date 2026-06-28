import { useEffect, useState } from 'react'
import type { UseOnboardingReturn } from '../../hooks/useOnboarding'
import { supabase } from '../../../shared/lib/supabase'
import { API_CONFIG } from '../../../shared/api/config'

interface RoutingStepProps {
  onboarding: UseOnboardingReturn
}

type RoutingConfig = {
  fallback: { ok: boolean; reason?: string | null; station?: { id: string; name: string } | null }
  stations: Array<{ id: string; name: string; is_fallback?: boolean }>
  targets: Array<{ id: string; name: string; connection_type: string }>
  menu_items: Array<{ id: string; name: string; category?: string; routing_publishable?: boolean }>
}

async function routingFetch(restaurantId: string, path = '', options: RequestInit = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  const response = await fetch(`${API_CONFIG.baseUrl}/restaurants/${restaurantId}/kitchen-routing${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      ...(options.headers || {}),
    },
  })
  if (!response.ok) throw new Error(await response.text())
  return response.json()
}

export function RoutingStep({ onboarding }: RoutingStepProps) {
  const restaurantId = onboarding.restaurantId
  const [config, setConfig] = useState<RoutingConfig | null>(null)
  const [stationName, setStationName] = useState('Expo')
  const [targetName, setTargetName] = useState('Kitchen Printer')
  const [targetHost, setTargetHost] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const load = async () => {
    if (!restaurantId) return
    setLoading(true)
    setError(null)
    try {
      setConfig(await routingFetch(restaurantId))
    } catch {
      setError('Could not load kitchen routing setup.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [restaurantId])

  const createStation = async () => {
    if (!restaurantId || !stationName.trim()) return
    await routingFetch(restaurantId, '/stations', {
      method: 'POST',
      body: JSON.stringify({ name: stationName.trim(), is_active: true }),
    })
    setStationName('')
    await load()
  }

  const createTarget = async () => {
    if (!restaurantId) return
    await routingFetch(restaurantId, '/targets', {
      method: 'POST',
      body: JSON.stringify({
        name: targetName.trim() || 'Kitchen Printer',
        target_type: 'printer',
        connection_type: targetHost.trim() ? 'network' : 'dummy',
        config: targetHost.trim() ? { host: targetHost.trim(), port: 9100, profile: 'TM-T88V' } : {},
        is_active: true,
      }),
    })
    setTargetHost('')
    await load()
  }

  const assignFirst = async () => {
    if (!restaurantId || !config?.stations[0] || !config?.targets[0]) return
    await routingFetch(restaurantId, '/station-targets', {
      method: 'POST',
      body: JSON.stringify({ station_id: config.stations[0].id, target_id: config.targets[0].id, priority: 0, is_active: true }),
    })
    await routingFetch(restaurantId, '/fallback', {
      method: 'PUT',
      body: JSON.stringify({ station_id: config.stations[0].id }),
    })
    await load()
  }

  const blockedItems = (config?.menu_items || []).filter(item => !item.routing_publishable).length

  return (
    <div className="space-y-6">
      {error && <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}
      {loading && <p className="text-sm text-[rgb(var(--text-tertiary))]">Loading routing...</p>}

      <div className={`rounded-2xl border p-4 ${config?.fallback?.ok ? 'border-emerald-500/20 bg-emerald-500/10' : 'border-red-500/20 bg-red-500/10'}`}>
        <p className="label-mono text-[rgb(var(--gold))]">Fallback Guarantee</p>
        <p className="mt-2 text-sm text-[rgb(var(--text-secondary))]">
          {config?.fallback?.ok ? 'Fallback station is configured with an output target.' : config?.fallback?.reason || 'A fallback station with a target is required before launch.'}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-sm font-semibold text-[rgb(var(--text-primary))]">Station</p>
          <input className="mt-3 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white" value={stationName} onChange={event => setStationName(event.target.value)} />
          <button className="mt-3 rounded-xl bg-[rgb(var(--gold))] px-4 py-2 text-sm font-semibold text-black" onClick={() => void createStation()}>Create station</button>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-sm font-semibold text-[rgb(var(--text-primary))]">Target</p>
          <input className="mt-3 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white" value={targetName} onChange={event => setTargetName(event.target.value)} />
          <input className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white" placeholder="Printer host/IP, or blank for dummy" value={targetHost} onChange={event => setTargetHost(event.target.value)} />
          <button className="mt-3 rounded-xl bg-[rgb(var(--gold))] px-4 py-2 text-sm font-semibold text-black" onClick={() => void createTarget()}>Create target</button>
        </div>
      </div>

      <button className="w-full rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold text-[rgb(var(--text-primary))]" onClick={() => void assignFirst()}>
        Assign first target to first station and set fallback
      </button>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <p className="text-sm font-semibold text-[rgb(var(--text-primary))]">Launch Coverage</p>
        <p className="mt-2 text-sm text-[rgb(var(--text-secondary))]">
          {blockedItems} menu item{blockedItems === 1 ? '' : 's'} still need explicit confirmation or route coverage before they should be published.
        </p>
      </div>

      <button
        type="button"
        onClick={onboarding.nextStep}
        className="w-full rounded-xl bg-white px-4 py-4 text-sm font-semibold text-black transition-colors hover:bg-gray-100"
      >
        Continue
      </button>
    </div>
  )
}
