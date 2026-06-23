import type { TextStyle, ViewStyle } from 'react-native';

import { semanticColors, statusColors } from './colors';
import { shadowMd, shadowSm } from './shadows';

export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;

export const radius = {
  none: 0,
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  pill: 999,
} as const;

export const layout = {
  screenPadding: spacing[5],
  sectionGap: spacing[6],
  rowGap: spacing[3],
  controlHeight: 48,
  controlHeightSmall: 38,
  touchTarget: 44,
  maxContentWidth: 720,
} as const;

export const card = {
  base: {
    backgroundColor: semanticColors.elevated,
    borderColor: semanticColors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing[4],
  },
  raised: {
    backgroundColor: semanticColors.elevated,
    borderColor: semanticColors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing[4],
    ...shadowMd,
  },
  compact: {
    backgroundColor: semanticColors.elevated,
    borderColor: semanticColors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    padding: spacing[3],
  },
} satisfies Record<string, ViewStyle>;

export const field = {
  base: {
    minHeight: layout.controlHeight,
    backgroundColor: semanticColors.elevated,
    borderColor: semanticColors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    color: semanticColors.text,
    paddingHorizontal: spacing[3],
  },
  focused: {
    borderColor: semanticColors.primary,
  },
  disabled: {
    backgroundColor: semanticColors.surface,
    color: semanticColors.textSubtle,
    opacity: 0.7,
  },
  label: {
    color: semanticColors.textMuted,
    marginBottom: spacing[2],
  },
  helper: {
    color: semanticColors.textSubtle,
    marginTop: spacing[2],
  },
} satisfies Record<string, ViewStyle | TextStyle>;

export const button = {
  base: {
    alignItems: 'center',
    borderRadius: radius.sm,
    flexDirection: 'row',
    gap: spacing[2],
    justifyContent: 'center',
    minHeight: layout.controlHeight,
    paddingHorizontal: spacing[4],
  },
  small: {
    minHeight: layout.controlHeightSmall,
    paddingHorizontal: spacing[3],
  },
  primary: {
    backgroundColor: semanticColors.primary,
    borderColor: semanticColors.primary,
    borderWidth: 1,
  },
  secondary: {
    backgroundColor: semanticColors.elevated,
    borderColor: semanticColors.borderStrong,
    borderWidth: 1,
  },
  ghost: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    borderWidth: 1,
  },
  danger: {
    backgroundColor: statusColors.danger.strong,
    borderColor: statusColors.danger.strong,
    borderWidth: 1,
  },
  pressed: {
    opacity: 0.82,
  },
  disabled: {
    opacity: 0.52,
  },
} satisfies Record<string, ViewStyle>;

export const status = statusColors;

export const divider: ViewStyle = {
  backgroundColor: semanticColors.border,
  height: 1,
};

export const hairline: ViewStyle = {
  ...divider,
  ...shadowSm,
};

export type SpacingToken = keyof typeof spacing;
export type RadiusToken = keyof typeof radius;
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'default' | 'small';
export type CardVariant = keyof typeof card;
