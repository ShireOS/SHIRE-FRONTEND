import { useEffect, useRef, useState } from 'react'
import { TopBar } from '../host/components/layout/TopBar'
import { LeftPanel } from './LeftPanel'
import { AddGuestModal } from './AddGuestModal'
import { CameraViewer } from './CameraViewer'
import { CenterPanel } from '../host/components/layout/CenterPanel'
import { RightPanel } from '../host/components/layout/RightPanel'
import { useRestaurantStore } from '../host/stores/restaurantStore'
import { supabase } from '../shared/lib/supabase'
import { API_CONFIG } from '../shared/api/config'
import type { Table, TableShape, TableStatus } from '../host/types'

const RESTAURANT_ID = import.meta.env.VITE_RESTAURANT_ID || ''

// Stage dimensions match CenterPanel floor plan stage
const STAGE_W = 700
const STAGE_H = 420

/**
 * Deterministic initial status for backtesting.
 * Rules (same every run):
 *  - Bar tables 35, 37 → needs_server / dirty (so bar still has 31, 33 available)
 *  - Every 10th table     → dirty  (~10%)
 *  - Every other even     → needs_server (~40%)
 *  - Everything else      → available (~50%)
 * Result: ~50% green, ~40% yellow, ~10% brown across all zones.
 */
function getInitialStatus(n: number): TableStatus {
  if (n === 35) return 'needs_server'
  if (n === 37) return 'dirty'
  if (n % 10 === 0) return 'dirty'
  if (n % 2 === 0) return 'needs_server'
  return 'available'
}

// Distribute needs_server tables evenly across the 5 mock servers (s1–s5)
const SERVER_IDS = ['s1', 's2', 's3', 's4', 's5']

function getInitialServerId(n: number, status: TableStatus): string | null {
  if (status !== 'needs_server') return null
  return SERVER_IDS[n % SERVER_IDS.length]
}

function floorPlanToTables(fp: any): Table[] {
  const rawTables: any[] = fp?.tables ?? []
  if (!rawTables.length) return []

  return rawTables.map((t: any, index: number) => {
    const pos = t.position ?? {}
    const centerX: number = pos.center_x ?? 50
    const centerY: number = pos.center_y ?? 50
    const widthPct: number = pos.width ?? 12
    const heightPct: number = pos.height ?? 10

    // Convert percentage coords → pixel top-left corner
    const widthPx = (widthPct / 100) * STAGE_W
    const heightPx = (heightPct / 100) * STAGE_H
    const x = Math.max(0, (centerX / 100) * STAGE_W - widthPx / 2)
    const y = Math.max(0, (centerY / 100) * STAGE_H - heightPx / 2)

    // Map floor-plan shape names to host UI shape types
    let shape: TableShape = 'square'
    if (t.shape === 'rectangular' || t.shape === 'rectangle') shape = 'rectangle'
    else if (t.shape === 'circular' || t.shape === 'round') shape = 'round'

    const number = index + 1

    const status = getInitialStatus(number)
    return {
      id: t.id ?? `bt-${index}`,
      number,
      tableNumber: `T${number}`,
      shape,
      capacity: t.capacity ?? 4,
      position: { x, y },
      rotation: 0,
      sectionId: 'default',
      status,
      assignedServerId: getInitialServerId(number, status),
      currentGuestId: null,
      seatedAt: null,
      reservedFor: null,
      cvConfidence: 1.0,
    }
  })
}

function BacktestingApp() {
  const initDone = useRef(false)
  const theme = useRestaurantStore((s) => s.theme)
  const [addModal, setAddModal] = useState<{ mode: 'walkin' | 'reservation'; anchor?: DOMRect } | null>(null)
  const [cameraOpen, setCameraOpen] = useState(false)

  // Simulate CV detection: table 21 goes green → yellow after 3 s
  useEffect(() => {
    const timer = window.setTimeout(() => {
      useRestaurantStore.setState((state) => ({
        tables: state.tables.map((t) =>
          t.number === 21 && t.status === 'available'
            ? { ...t, status: 'needs_server' as TableStatus, assignedServerId: getInitialServerId(21, 'needs_server') }
            : t
        ),
      }))
    }, 3000)
    return () => clearTimeout(timer)
  }, [])

  // Keep theme class in sync
  useEffect(() => {
    document.documentElement.classList.remove('dark', 'light')
    document.documentElement.classList.add(theme)
  }, [theme])

  // Load real floor plan from backend on mount; start with empty waitlist/activity
  useEffect(() => {
    if (initDone.current) return
    initDone.current = true

    // Clear all mock data; apply deterministic initial statuses to mock tables as fallback
    useRestaurantStore.setState({
      guests: [],
      reservations: [],
      activity: [],
      recommendations: [],
      tables: useRestaurantStore.getState().tables.map(t => {
        const status = getInitialStatus(t.number)
        return { ...t, status, assignedServerId: getInitialServerId(t.number, status) }
      }),
    })

    const load = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const token = session?.access_token ? `Bearer ${session.access_token}` : ''

        const res = await fetch(
          `${API_CONFIG.baseUrl}/restaurants/${RESTAURANT_ID}/floor-plan`,
          { headers: { Authorization: token } }
        )

        if (!res.ok) {
          console.warn('[Backtesting] Floor plan fetch failed:', res.status, '— using mock data')
          return
        }

        const fp = await res.json()
        const tables = floorPlanToTables(fp)

        if (tables.length > 0) {
          useRestaurantStore.setState({ tables })
          console.log(`[Backtesting] Loaded ${tables.length} tables from floor plan`)
        } else {
          console.warn('[Backtesting] Floor plan has no tables — using mock data')
        }
      } catch (err) {
        console.error('[Backtesting] Error loading floor plan:', err)
      }
    }

    void load()
  }, [])

  return (
    <div className="w-full h-full flex flex-col bg-base">
      {/* Backtesting mode indicator */}
      <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-1 text-center">
        <span className="text-xs font-mono text-amber-400/80 tracking-widest uppercase">
          Backtesting Mode
        </span>
      </div>

      <TopBar
        onOpenVideoViewer={() => setCameraOpen(true)}
        onAddWalkIn={(anchor) => setAddModal({ mode: 'walkin', anchor })}
        onAddReservation={(anchor) => setAddModal({ mode: 'reservation', anchor })}
      />

      <div className="flex-1 flex overflow-hidden">
        <LeftPanel onAddClick={(mode, anchor) => setAddModal({ mode, anchor })} />
        <CenterPanel />
        <RightPanel />
      </div>

      {addModal && (
        <AddGuestModal mode={addModal.mode} anchor={addModal.anchor} onClose={() => setAddModal(null)} />
      )}

      <CameraViewer isOpen={cameraOpen} onClose={() => setCameraOpen(false)} />
    </div>
  )
}

export default BacktestingApp
