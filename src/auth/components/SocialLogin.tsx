interface SocialLoginProps {
  onGoogleClick: () => void
  isLoading?: boolean
}

export function SocialLogin({ onGoogleClick, isLoading }: SocialLoginProps) {
  return (
    <div className="w-full">
      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-dash-border/20" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-4 bg-base text-tertiary text-xs font-medium uppercase tracking-wider">OR</span>
        </div>
      </div>

      <div className="flex gap-4 justify-center">
        <button
          type="button"
          onClick={onGoogleClick}
          disabled={isLoading}
          className="flex-1 flex items-center justify-center py-3.5 rounded-xl border border-dash-border/40 hover:border-dash-border/80 bg-base transition-all disabled:opacity-50 shadow-[0_1px_3px_rgba(0,0,0,0.02)]"
        >
          <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
        </button>

        <button
          type="button"
          disabled={isLoading}
          className="flex-1 flex items-center justify-center py-3.5 rounded-xl border border-dash-border/40 hover:border-dash-border/80 bg-base transition-all disabled:opacity-50 shadow-[0_1px_3px_rgba(0,0,0,0.02)]"
        >
          <svg className="w-[18px] h-[18px] text-[#1877F2]" fill="currentColor" viewBox="0 0 24 24">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
          </svg>
        </button>

        <button
          type="button"
          disabled={isLoading}
          className="flex-1 flex items-center justify-center py-3.5 rounded-xl border border-dash-border/40 hover:border-dash-border/80 bg-base transition-all disabled:opacity-50 shadow-[0_1px_3px_rgba(0,0,0,0.02)]"
        >
          <svg className="w-[18px] h-[18px] dark:fill-white fill-black" viewBox="0 0 24 24">
            <path d="M16.365 21.435c-1.503.738-2.618.73-4.045 0-2.859-1.458-6.191-8.31-4.717-12.782.723-2.188 2.37-3.447 4.223-3.447 1.332 0 2.417.809 3.255.809.805 0 2.1-.885 3.593-.885 1.508 0 2.87.643 3.655 1.76-3.156 1.83-2.628 5.753.483 6.944-1.127 3.024-3.596 6.136-6.447 7.601zM11.964 4.88c-.28-3.085 2.47-5.066 5.09-5.263.385 3.033-2.585 5.352-5.09 5.263z" />
          </svg>
        </button>
      </div>
    </div>
  )
}
