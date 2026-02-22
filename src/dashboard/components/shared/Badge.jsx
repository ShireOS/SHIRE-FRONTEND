const variants = {
  success: 'bg-dash-success/20 text-dash-success border border-dash-success/30',
  warning: 'bg-dash-warning/20 text-dash-warning border border-dash-warning/30',
  danger: 'bg-dash-danger/20 text-dash-danger border border-dash-danger/30',
  info: 'bg-dash-cream/10 text-dash-cream border border-dash-border',
  neutral: 'bg-dash-cream/5 text-dash-secondary border border-dash-border',
  purple: 'bg-purple-500/20 text-purple-400 border border-purple-500/30',
  gold: 'bg-dash-gold/20 text-dash-gold border border-dash-gold/30'
}

export function Badge({ children, variant = 'neutral', dot = false, className = '' }) {
  return (
    <span className={`
      inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium
      ${variants[variant]}
      ${className}
    `}>
      {dot && (
        <span className={`w-1.5 h-1.5 rounded-full ${
          variant === 'success' ? 'bg-dash-success' :
          variant === 'warning' ? 'bg-dash-warning' :
          variant === 'danger' ? 'bg-dash-danger' :
          variant === 'gold' ? 'bg-dash-gold' :
          'bg-dash-secondary'
        }`} />
      )}
      {children}
    </span>
  )
}

export function StatusDot({ status }) {
  const colors = {
    occupied: 'bg-dash-danger',
    needsAttention: 'bg-dash-warning',
    dirty: 'bg-dash-neutral',
    open: 'bg-dash-success'
  }

  return (
    <span className={`w-2 h-2 rounded-full ${colors[status] || 'bg-dash-neutral'}`} />
  )
}
