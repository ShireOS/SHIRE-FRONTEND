import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  darkMode: 'class',
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        cream:   { 50: '#FAFAFA', 100: '#F9F8F8', 200: '#F4F1EE', 300: '#F1EBE5' },
        sand:    { 200: '#EDDFD0', 300: '#F4E6DA' },
        stone:   { 100: '#EDEFF0', 200: '#E4E2E2' },
        sky:     { 50: '#F0F6FF', 100: '#E9EFFF', 200: '#E2ECF5', 300: '#A7CBF2', 400: '#9CC1E7', 500: '#84B9EF', 600: '#6F86FF', 700: '#156CC2' },
        ink:     { 400: '#616161', 500: '#757170', 600: '#614A44', 700: '#453F3D', 800: '#151313', 900: '#1A1615' },
        success: { 600: '#0EA158', 700: '#118647', 800: '#168804' },
        warning: { 600: '#CF8D13' },
        danger:  { 600: '#C9502E' },
        warmth:  { 600: '#754D29' },
        // Semantic aliases (used as bg-bg, bg-surface, bg-elevated, with dark: variants)
        bg:       { DEFAULT: '#FAFAFA', dark: '#151313' },
        surface:  { DEFAULT: '#F9F8F8', dark: '#1A1615' },
        elevated: { DEFAULT: '#FFFFFF', dark: '#221E1D' },
      },
      borderRadius: {
        sm: '12px', md: '20px', lg: '24px', xl: '28px', '2xl': '40px', full: '9999px',
      },
      spacing: {
        '1': '4px', '2': '8px', '3': '12px', '4': '16px', '5': '20px', '6': '24px',
        '8': '32px', '10': '40px', '12': '48px', '16': '64px',
      },
      fontFamily: {
        sans: ['Inter_400Regular', 'Inter_500Medium', 'Inter_600SemiBold', 'system-ui', 'sans-serif'],
        mono: ['FragmentMono_400Regular', 'ui-monospace', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
