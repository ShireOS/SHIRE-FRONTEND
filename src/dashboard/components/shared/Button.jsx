const variants = {
  primary: 'bg-dash-gold text-dash-base hover:bg-dash-gold/90 shadow-gold-glow',
  secondary: 'bg-white/10 text-dash-cream hover:bg-white/20 border border-dash-border',
  outline: 'border border-dash-border text-dash-cream hover:bg-white/5 hover:border-dash-gold/30',
  ghost: 'text-dash-secondary hover:bg-white/5 hover:text-dash-cream',
  danger: 'bg-dash-danger/20 text-dash-danger hover:bg-dash-danger/30 border border-dash-danger/30',
  success: 'bg-dash-success/20 text-dash-success hover:bg-dash-success/30 border border-dash-success/30'
}

const sizes = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-base'
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  icon,
  iconPosition = 'left',
  ...props
}) {
  return (
    <button
      className={`
        inline-flex items-center justify-center gap-2 font-medium rounded-lg
        transition-all duration-200 active:scale-95
        disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100
        ${variants[variant]}
        ${sizes[size]}
        ${className}
      `}
      {...props}
    >
      {icon && iconPosition === 'left' && icon}
      {children}
      {icon && iconPosition === 'right' && icon}
    </button>
  )
}
