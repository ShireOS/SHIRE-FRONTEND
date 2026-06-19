import type { ViewStyle } from 'react-native';

// Warm shadows (light mode) and darker shadows for dark mode.
// Use as: <View style={[styles.card, shadowMd]} /> or via NativeWind `style` prop merge.

export const shadowSm: ViewStyle = {
  shadowColor: '#614A44', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2,
};
export const shadowMd: ViewStyle = {
  shadowColor: '#614A44', shadowOpacity: 0.10, shadowRadius: 50, shadowOffset: { width: 0, height: 4 }, elevation: 6,
};
export const shadowLg: ViewStyle = {
  shadowColor: '#3C78BE', shadowOpacity: 0.10, shadowRadius: 45, shadowOffset: { width: 0, height: 18 }, elevation: 10,
};

export const shadowSmDark: ViewStyle = {
  shadowColor: '#000000', shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2,
};
export const shadowMdDark: ViewStyle = {
  shadowColor: '#000000', shadowOpacity: 0.40, shadowRadius: 50, shadowOffset: { width: 0, height: 4 }, elevation: 6,
};
export const shadowLgDark: ViewStyle = {
  shadowColor: '#000000', shadowOpacity: 0.40, shadowRadius: 45, shadowOffset: { width: 0, height: 18 }, elevation: 10,
};
