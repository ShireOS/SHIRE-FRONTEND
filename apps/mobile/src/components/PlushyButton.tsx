import React from 'react';
import { Pressable, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

const EASE_OUT_CUBIC = Easing.bezier(0.33, 1, 0.68, 1);
const EASE_OUT_BACK = Easing.bezier(0.34, 1.56, 0.64, 1);

export interface PlushyButtonProps {
  onPress?: () => void;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  pressedScale?: number;
  pressedRotation?: number;
  pressDuration?: number;
  releaseDuration?: number;
  accessibilityLabel?: string;
  disabled?: boolean;
}

export function PlushyButton({
  onPress,
  children,
  style,
  pressedScale = 1.04,
  pressedRotation = 0.025,
  pressDuration = 130,
  releaseDuration = 320,
  accessibilityLabel,
  disabled = false,
}: PlushyButtonProps) {
  const progress = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${progress.value * pressedRotation}rad` },
      { scale: 1 + progress.value * (pressedScale - 1) },
    ],
  }));

  const handlePressIn = () => {
    if (disabled) return;
    progress.value = withTiming(1, {
      duration: pressDuration,
      easing: EASE_OUT_CUBIC,
    });
  };

  const handlePressOut = () => {
    if (disabled) return;
    progress.value = withTiming(0, {
      duration: releaseDuration,
      easing: EASE_OUT_BACK,
    });
  };

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={disabled ? undefined : onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
    >
      <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>
    </Pressable>
  );
}

export default PlushyButton;
