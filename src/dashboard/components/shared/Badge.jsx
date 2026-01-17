const variants = {
  success: 'bg-green-100 text-green-700',
  warning: 'bg-amber-100 text-amber-700',
  danger: 'bg-red-100 text-red-700',
  info: 'bg-blue-100 text-blue-700',
  neutral: 'bg-gray-100 text-gray-700',
  purple: 'bg-purple-100 text-purple-700'
}

export function Badge({ children, variant = 'neutral', dot = false, className = '' }) {
  return (
    <span className={`
      inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
      ${variants[variant]}
      ${className}
    `}>
      {dot && (
        <span className={`w-2 h-2 rounded-full ${
          variant === 'success' ? 'bg-green-500' :
          variant === 'warning' ? 'bg-amber-500' :
          variant === 'danger' ? 'bg-red-500' :
          variant === 'info' ? 'bg-blue-500' :
          'bg-gray-500'
        }`} />
      )}
      {children}
    </span>
  )
}

export function StatusDot({ status }) {
  const colors = {
    occupied: 'bg-green-500',
    needsAttention: 'bg-amber-500',
    dirty: 'bg-red-500',
    open: 'bg-gray-300'
  }

  return (
    <span className={`w-2.5 h-2.5 rounded-full ${colors[status] || 'bg-gray-300'}`} />
  )
}
