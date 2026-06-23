import { View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';

import { card, radius, spacing, type CardVariant, type RadiusToken, type SpacingToken } from '@/styles/tokens';

export type SurfaceProps = ViewProps & {
  variant?: CardVariant;
  padding?: SpacingToken;
  rounded?: RadiusToken;
  style?: StyleProp<ViewStyle>;
};

export function Surface({ variant = 'base', padding, rounded, style, ...props }: SurfaceProps) {
  return (
    <View
      {...props}
      style={[
        card[variant],
        padding !== undefined && { padding: spacing[padding] },
        rounded !== undefined && { borderRadius: radius[rounded] },
        style,
      ]}
    />
  );
}
