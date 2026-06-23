import { Pressable, type PressableProps, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import { semanticColors } from '@/styles/colors';
import { button, type ButtonSize, type ButtonVariant } from '@/styles/tokens';

import { UiText } from './Text';

export type UiButtonProps = Omit<PressableProps, 'style'> & {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
};

const labelTone = {
  primary: 'inverse',
  secondary: 'default',
  ghost: 'default',
  danger: 'inverse',
} as const;

const variantTextColor = {
  primary: semanticColors.textInverse,
  secondary: semanticColors.text,
  ghost: semanticColors.text,
  danger: semanticColors.textInverse,
} satisfies Record<ButtonVariant, string>;

export function UiButton({
  label,
  variant = 'primary',
  size = 'default',
  disabled,
  style,
  labelStyle,
  accessibilityRole = 'button',
  ...props
}: UiButtonProps) {
  return (
    <Pressable
      {...props}
      accessibilityRole={accessibilityRole}
      disabled={disabled}
      style={({ pressed }) => [
        button.base,
        size === 'small' && button.small,
        button[variant],
        pressed && !disabled && button.pressed,
        disabled && button.disabled,
        style,
      ]}
    >
      <UiText
        variant={size === 'small' ? 'caption' : 'bodySmall'}
        tone={labelTone[variant]}
        style={[{ color: variantTextColor[variant] }, labelStyle]}
      >
        {label}
      </UiText>
    </Pressable>
  );
}
