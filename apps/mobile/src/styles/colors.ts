export const palette = {
  cream: { 50: '#FAFAFA', 100: '#F9F8F8', 200: '#F4F1EE', 300: '#F1EBE5' },
  sand: { 100: '#F8EFE6', 200: '#EDDFD0', 300: '#D8C4B2' },
  stone: { 50: '#F6F7F7', 100: '#EDEFF0', 200: '#E4E2E2', 300: '#CCC8C6' },
  sky: {
    50: '#F0F6FF',
    100: '#E9EFFF',
    200: '#E2ECF5',
    300: '#A7CBF2',
    400: '#9CC1E7',
    500: '#84B9EF',
    600: '#4F7EE8',
    700: '#156CC2',
  },
  mint: { 50: '#ECFDF4', 100: '#D8F6E6', 600: '#0EA158', 700: '#118647', 800: '#126D3C' },
  amber: { 50: '#FFF7E6', 100: '#F8E7BC', 600: '#CF8D13', 700: '#9A6508' },
  tomato: { 50: '#FFF1EC', 100: '#F9D4C8', 600: '#C9502E', 700: '#9E3921' },
  warmth: { 100: '#EFE4D9', 500: '#9C6B3F', 600: '#754D29', 700: '#533317' },
  ink: {
    100: '#F1EFEE',
    300: '#ABA4A1',
    400: '#8C8581',
    500: '#757170',
    600: '#614A44',
    700: '#453F3D',
    800: '#151313',
    900: '#1A1615',
  },
  success: { 50: '#ECFDF4', 100: '#D8F6E6', 600: '#0EA158', 700: '#118647', 800: '#126D3C' },
  warning: { 50: '#FFF7E6', 100: '#F8E7BC', 600: '#CF8D13', 700: '#9A6508' },
  danger: { 50: '#FFF1EC', 100: '#F9D4C8', 600: '#C9502E', 700: '#9E3921' },
  bg: { DEFAULT: '#FAFAFA', dark: '#151313' },
  surface: { DEFAULT: '#F9F8F8', dark: '#1A1615' },
  elevated: { DEFAULT: '#FFFFFF', dark: '#221E1D' },
} as const;

export const semanticColors = {
  background: palette.bg.DEFAULT,
  backgroundDark: palette.bg.dark,
  surface: palette.surface.DEFAULT,
  surfaceDark: palette.surface.dark,
  elevated: palette.elevated.DEFAULT,
  elevatedDark: palette.elevated.dark,
  border: palette.stone[200],
  borderStrong: palette.stone[300],
  text: palette.ink[900],
  textMuted: palette.ink[500],
  textSubtle: palette.ink[400],
  textInverse: '#FFFFFF',
  primary: palette.sky[700],
  primaryPressed: '#0D5AA6',
  accent: palette.warmth[600],
  overlay: 'rgba(21, 19, 19, 0.48)',
} as const;

export const statusColors = {
  success: { bg: palette.success[50], border: palette.success[100], text: palette.success[700], strong: palette.success[600] },
  warning: { bg: palette.warning[50], border: palette.warning[100], text: palette.warning[700], strong: palette.warning[600] },
  danger: { bg: palette.danger[50], border: palette.danger[100], text: palette.danger[700], strong: palette.danger[600] },
  info: { bg: palette.sky[50], border: palette.sky[200], text: palette.sky[700], strong: palette.sky[600] },
  neutral: { bg: palette.stone[50], border: palette.stone[200], text: palette.ink[600], strong: palette.ink[500] },
} as const;

export type Palette = typeof palette;
export type StatusTone = keyof typeof statusColors;

// Keep the original misspelled export for existing imports.
export const color_pallet = palette;
