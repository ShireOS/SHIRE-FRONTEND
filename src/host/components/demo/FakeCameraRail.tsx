import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Expand, Camera, Keyboard, Radio } from 'lucide-react'
import { useRestaurantStore } from '../../stores/restaurantStore'

interface FakeCameraRailProps {
  onOpenMultiCamera: () => void
}

export function FakeCameraRail({ onOpenMultiCamera }: FakeCameraRailProps) {
  const demoScene = useRestaurantStore((s) => s.demoScene)
  const lastCvUpdate = useRestaurantStore((s) => s.lastCvUpdate)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    video.defaultMuted = true
    video.muted = true
    video.playsInline = true

    const playPromise = video.play()
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {})
    }
  }, [demoScene?.id])

  const lastSeen = lastCvUpdate
    ? lastCvUpdate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' })
    : 'Live'

  return (
    <aside className="w-[340px] h-full border-l border-white/[0.06] glass-panel-flat flex flex-col">
      <div className="px-4 py-3 border-b border-white/[0.06]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-accent-green">
              <Radio className="w-3 h-3" />
              Live Camera Feed
            </div>
            <h3 className="mt-1 text-sm font-semibold text-primary">
              {demoScene?.cameraLabel || 'Camera 4 · Main dining + host line'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onOpenMultiCamera}
            className="w-8 h-8 rounded-lg border border-white/[0.08] bg-white/[0.03] flex items-center justify-center text-secondary hover:text-primary hover:bg-white/[0.06] transition-colors"
            title="Open full camera grid"
          >
            <Expand className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4 overflow-y-auto custom-scrollbar">
        <div className="relative overflow-hidden rounded-2xl border border-white/[0.1] bg-black shadow-[0_20px_40px_-28px_rgba(0,0,0,0.8)]">
          <video
            ref={videoRef}
            key={demoScene?.cameraPath || 'fake-camera'}
            src={demoScene?.cameraPath || '/demovids/4_Mimosas/demo1.mp4'}
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            className="aspect-video w-full object-cover"
          />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent p-3">
            <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.18em] text-white/70">
              <span>Computer Vision Active</span>
              <span>{lastSeen}</span>
            </div>
            <p className="mt-2 text-sm text-white/90">{demoScene?.description}</p>
          </div>
        </div>

        <motion.div
          key={demoScene?.id || 'scene-copy'}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-accent-primary/25 bg-accent-primary/[0.08] p-4"
        >
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-accent-primary">
            <Camera className="w-3 h-3" />
            Demo Cue
          </div>
          <h4 className="mt-2 text-base font-semibold text-primary">{demoScene?.title}</h4>
          <p className="mt-2 text-sm leading-relaxed text-secondary">{demoScene?.scriptCue}</p>
        </motion.div>

        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-tertiary">
            <Keyboard className="w-3 h-3" />
            Demo Controls
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <ControlChip label="Next Scene" keys="→ or Space" />
            <ControlChip label="Previous" keys="←" />
            <ControlChip label="Reset" keys="R" />
            <ControlChip label="All Cameras" keys="Open Grid" />
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-tertiary">
            What To Call Out
          </div>
          <div className="mt-3 space-y-2">
            {(demoScene?.highlights || []).map((highlight) => (
              <div key={highlight} className="flex items-start gap-2 text-sm text-secondary">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-accent-green" />
                <span>{highlight}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </aside>
  )
}

function ControlChip({ label, keys }: { label: string; keys: string }) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-black/20 px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-tertiary">{label}</div>
      <div className="mt-1 text-sm font-medium text-primary">{keys}</div>
    </div>
  )
}
