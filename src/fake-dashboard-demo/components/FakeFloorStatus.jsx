import { useState } from 'react'
import { ChevronRight, X } from 'lucide-react'
import { tables } from '../data/mimosasMockData'

const PREVIEW_TABLE_LIMIT = 16

const TABLE_STATUS_STYLES = {
  occupied: {
    tile: 'bg-dash-danger/20 border-dash-danger/40 hover:bg-dash-danger/25 hover:border-dash-danger/60 hover:shadow-[0_12px_22px_-16px_rgba(220,53,69,0.55)]',
    dot: 'bg-dash-danger',
  },
  needsAttention: {
    tile: 'bg-dash-warning/20 border-dash-warning/40 hover:bg-dash-warning/25 hover:border-dash-warning/60 hover:shadow-[0_12px_22px_-16px_rgba(217,119,6,0.5)]',
    dot: 'bg-dash-warning',
  },
  dirty: {
    tile: 'bg-dash-cream/5 border-dashed border-dash-tertiary/45 hover:bg-dash-cream/10 hover:border-dash-tertiary/70 hover:shadow-[0_10px_20px_-16px_rgba(96,82,60,0.45)]',
    dot: 'bg-dash-neutral',
  },
  open: {
    tile: 'bg-dash-success/20 border-dash-success/40 hover:bg-dash-success/25 hover:border-dash-success/60 hover:shadow-[0_12px_22px_-16px_rgba(40,167,69,0.55)]',
    dot: 'bg-dash-success',
  },
}

const LEGEND_ITEMS = [
  { label: 'Occupied', dot: 'bg-dash-danger' },
  { label: 'Needs Attn', dot: 'bg-dash-warning' },
  { label: 'Dirty', dot: 'bg-dash-neutral' },
  { label: 'Open', dot: 'bg-dash-success' },
]

function FloorPlanLegend({ className = '' }) {
  return (
    <div className={`flex flex-wrap gap-5 label-mono ${className}`}>
      {LEGEND_ITEMS.map((item) => (
        <div key={item.label} className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${item.dot}`} />
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  )
}

function FloorTableTile({ table }) {
  const style = TABLE_STATUS_STYLES[table.status] || TABLE_STATUS_STYLES.open

  return (
    <div
      className={`group aspect-square rounded-lg border flex flex-col items-center justify-center cursor-pointer transition-all duration-200 hover:-translate-y-0.5 ${style.tile}`}
      title={`Table ${table.id}`}
    >
      <span className="font-dash-display italic text-xl text-dash-cream transition-colors group-hover:text-dash-gold">{table.id}</span>
      <span className={`w-2 h-2 rounded-full ${style.dot} mt-1.5 transition-transform duration-200 group-hover:scale-125`} />
    </div>
  )
}

export function FakeFloorStatus() {
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const previewTables = tables.slice(0, PREVIEW_TABLE_LIMIT)
  const hiddenTableCount = Math.max(tables.length - PREVIEW_TABLE_LIMIT, 0)

  return (
    <>
      <div className="h-full p-6 rounded-lg glass-card relative overflow-hidden">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-semibold text-lg text-dash-cream">
            Floor <span className="font-dash-display italic text-dash-gold">Plan</span>
          </h3>
          <button
            type="button"
            onClick={() => setIsDetailOpen(true)}
            className="label-mono text-dash-tertiary hover:text-dash-gold flex items-center gap-1 transition-colors bg-dash-cream/5 px-3 py-1.5 rounded-lg border border-dash-border hover:border-dash-gold/30"
          >
            VIEW DETAIL <ChevronRight size={14} />
          </button>
        </div>

        <div className="bg-dash-base rounded-lg p-4 mb-4 soft-inset-surface">
          <div className="grid grid-cols-4 gap-3">
            {previewTables.map((table) => (
              <FloorTableTile key={table.id} table={table} />
            ))}
          </div>
        </div>

        {hiddenTableCount > 0 && (
          <button
            type="button"
            onClick={() => setIsDetailOpen(true)}
            className="w-full mb-4 px-3 py-2 rounded-lg border border-dashed border-dash-border bg-dash-cream/5 text-dash-tertiary hover:text-dash-secondary hover:border-dash-gold/40 hover:bg-dash-gold/5 transition-all text-xs"
          >
            Showing {previewTables.length} of {tables.length} tables. <span className="text-dash-gold">+{hiddenTableCount} more in detail view</span>
          </button>
        )}

        <FloorPlanLegend className="pt-4 soft-divider-top" />
      </div>

      {isDetailOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <button
            type="button"
            aria-label="Close floor plan detail"
            className="fixed inset-0 bg-dash-base/70 backdrop-blur-sm"
            onClick={() => setIsDetailOpen(false)}
          />
          <div className="relative min-h-full flex items-center justify-center p-4">
            <div className="relative w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-xl bg-dash-surface border border-dash-border shadow-2xl">
              <div className="flex items-center justify-between p-5 soft-divider-bottom bg-dash-surface/95 backdrop-blur-sm">
                <div>
                  <h3 className="text-lg font-semibold text-dash-cream">Full Floor <span className="font-dash-display italic text-dash-gold">Detail</span></h3>
                  <p className="text-xs text-dash-tertiary mt-1">{tables.length} live tables</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDetailOpen(false)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-dash-tertiary hover:text-dash-cream hover:bg-dash-cream/10 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-5 overflow-y-auto max-h-[calc(90vh-82px)]">
                <FloorPlanLegend className="mb-4" />
                <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-3">
                  {tables.map((table) => (
                    <FloorTableTile key={`detail-${table.id}`} table={table} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
