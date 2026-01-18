export function Card({ children, className = '', hover = false, onClick }) {
  return (
    <div
      className={`
        glass-card rounded-lg
        ${hover ? 'hover:border-dash-gold/30 hover:shadow-gold-glow transition-all duration-200 cursor-pointer' : ''}
        ${className}
      `}
      onClick={onClick}
    >
      {children}
    </div>
  )
}

export function CardHeader({ children, className = '' }) {
  return (
    <div className={`px-6 py-4 border-b border-dash-border ${className}`}>
      {children}
    </div>
  )
}

export function CardContent({ children, className = '' }) {
  return (
    <div className={`p-6 ${className}`}>
      {children}
    </div>
  )
}
