import { Text, type TextProps, type StyleProp, type TextStyle } from 'react-native';

import { semanticColors, statusColors } from '@/styles/colors';
import { typography, type TypographyVariant } from '@/styles/typography';

type TextTone = 'default' | 'muted' | 'subtle' | 'inverse' | 'success' | 'warning' | 'danger' | 'info';

export type UiTextProps = TextProps & {
  variant?: TypographyVariant;
  tone?: TextTone;
  style?: StyleProp<TextStyle>;
};

const toneStyles = {
  default: { color: semanticColors.text },
  muted: { color: semanticColors.textMuted },
  subtle: { color: semanticColors.textSubtle },
  inverse: { color: semanticColors.textInverse },
  success: { color: statusColors.success.text },
  warning: { color: statusColors.warning.text },
  danger: { color: statusColors.danger.text },
  info: { color: statusColors.info.text },
} satisfies Record<TextTone, TextStyle>;

export function UiText({ variant = 'body', tone = 'default', style, ...props }: UiTextProps) {
  return <Text {...props} style={[typography[variant], toneStyles[tone], style]} />;
}
