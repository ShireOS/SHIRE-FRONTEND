import type { TextStyle } from 'react-native';

export const typography = {
  display:   { fontFamily: 'Inter_600SemiBold', fontSize: 48, letterSpacing: -0.96 },
  h1:        { fontFamily: 'Inter_700Bold', fontSize: 40, letterSpacing: -0.48 },
  h2:        { fontFamily: 'Inter_600SemiBold', fontSize: 24, letterSpacing: -0.24 },
  h3:        { fontFamily: 'Inter_600SemiBold', fontSize: 20, letterSpacing: -0.10 },
  title:     { fontFamily: 'Inter_500Medium',   fontSize: 18, letterSpacing: 0 },
  body:      { fontFamily: 'Inter_400Regular',  fontSize: 16, letterSpacing: 0 },
  bodySmall: { fontFamily: 'Inter_400Regular',  fontSize: 14, letterSpacing: 0 },
  caption:   { fontFamily: 'Inter_500Medium',   fontSize: 13, letterSpacing: 0.13 },
  eyebrow:   { fontFamily: 'FragmentMono_400Regular', fontSize: 12, letterSpacing: 0.72, textTransform: 'uppercase' as const },
  metric:    { fontFamily: 'FragmentMono_400Regular', fontSize: 48, letterSpacing: -0.48 },
} satisfies Record<string, TextStyle>;

export type TypographyVariant = keyof typeof typography;
