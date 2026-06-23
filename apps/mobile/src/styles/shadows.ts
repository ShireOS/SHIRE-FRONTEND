import type { ViewStyle } from 'react-native';

export const shadowSm: ViewStyle = {
  shadowColor: '#614A44',
  shadowOpacity: 0.06,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 2 },
  elevation: 2,
};
export const shadowMd: ViewStyle = {
  shadowColor: '#614A44',
  shadowOpacity: 0.1,
  shadowRadius: 24,
  shadowOffset: { width: 0, height: 8 },
  elevation: 6,
};
export const shadowLg: ViewStyle = {
  shadowColor: '#3C78BE',
  shadowOpacity: 0.12,
  shadowRadius: 36,
  shadowOffset: { width: 0, height: 18 },
  elevation: 10,
};

export const shadowSmDark: ViewStyle = {
  shadowColor: '#000000',
  shadowOpacity: 0.25,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 2 },
  elevation: 2,
};
export const shadowMdDark: ViewStyle = {
  shadowColor: '#000000',
  shadowOpacity: 0.34,
  shadowRadius: 24,
  shadowOffset: { width: 0, height: 8 },
  elevation: 6,
};
export const shadowLgDark: ViewStyle = {
  shadowColor: '#000000',
  shadowOpacity: 0.42,
  shadowRadius: 36,
  shadowOffset: { width: 0, height: 18 },
  elevation: 10,
};

export const shadows = {
  sm: shadowSm,
  md: shadowMd,
  lg: shadowLg,
  smDark: shadowSmDark,
  mdDark: shadowMdDark,
  lgDark: shadowLgDark,
} as const;

export type ShadowToken = keyof typeof shadows;
