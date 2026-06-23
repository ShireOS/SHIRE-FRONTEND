import type { TextStyle } from 'react-native';

export const typography = {
  display: { fontFamily: 'Inter_600SemiBold', fontSize: 44, lineHeight: 52, letterSpacing: 0 },
  h1: { fontFamily: 'Inter_700Bold', fontSize: 34, lineHeight: 42, letterSpacing: 0 },
  h2: { fontFamily: 'Inter_600SemiBold', fontSize: 24, lineHeight: 32, letterSpacing: 0 },
  h3: { fontFamily: 'Inter_600SemiBold', fontSize: 20, lineHeight: 28, letterSpacing: 0 },
  title: { fontFamily: 'Inter_500Medium', fontSize: 18, lineHeight: 24, letterSpacing: 0 },
  body: { fontFamily: 'Inter_400Regular', fontSize: 16, lineHeight: 24, letterSpacing: 0 },
  bodySmall: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20, letterSpacing: 0 },
  caption: { fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 18, letterSpacing: 0 },
  eyebrow: {
    fontFamily: 'FragmentMono_400Regular',
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.6,
    textTransform: 'uppercase' as const,
  },
  metric: { fontFamily: 'FragmentMono_400Regular', fontSize: 42, lineHeight: 48, letterSpacing: 0 },
  metricSmall: { fontFamily: 'FragmentMono_400Regular', fontSize: 28, lineHeight: 34, letterSpacing: 0 },
} satisfies Record<string, TextStyle>;

export type TypographyVariant = keyof typeof typography;
