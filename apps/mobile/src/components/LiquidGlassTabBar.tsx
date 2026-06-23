import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View, Platform, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, withSpring, withTiming, Easing } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { BlurView } from 'expo-blur';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { typography } from '@/styles/typography';
import { color_pallet } from '@/styles/colors';
import { shadowLgDark } from '@/styles/shadows';

const SPRING = { damping: 22, stiffness: 320, mass: 0.55 };
const TIMING = { duration: 160, easing: Easing.out(Easing.quad) };

const PILL_HEIGHT = 64;
const PILL_RADIUS = 32;
const PILL_INSET = 6;
const HORIZONTAL_MARGIN = 24;

export type LiquidGlassTabBarProps = BottomTabBarProps & {
  activeColor?: string;
  inactiveColor?: string;
  bottomOffset?: number;
  /** Tint applied to the glass surface (iOS 26 only). */
  tintColor?: string;
};

export function LiquidGlassTabBar({
  state,
  descriptors,
  navigation,
  activeColor = color_pallet.cream[50],
  inactiveColor = color_pallet.ink[700],
  bottomOffset = 0,
  tintColor,
}: LiquidGlassTabBarProps) {
  const insets = useSafeAreaInsets();
  const [pillWidth, setPillWidth] = useState(0);

  const visibleRoutes = state.routes.filter((route) => {
    const { options } = descriptors[route.key];
    return (options as { href?: string | null }).href !== null;
  });

  const focusedIndex = Math.max(
    0,
    visibleRoutes.findIndex((r) => r.key === state.routes[state.index].key),
  );

  const tabWidth = pillWidth > 0 ? (pillWidth - PILL_INSET * 2) / visibleRoutes.length : 0;

  const indicatorStyle = useAnimatedStyle(() => {
    if (tabWidth === 0) return { opacity: 0 };
    return {
      opacity: withTiming(1, TIMING),
      width: tabWidth,
      transform: [{ translateX: withSpring(PILL_INSET + focusedIndex * tabWidth, SPRING) }],
    };
  });

  return (
    <View
      pointerEvents="box-none"
      style={[styles.container, { paddingBottom: Math.max(insets.bottom, 12) + bottomOffset }]}
    >
      <View
        style={[styles.pillWrapper, { marginHorizontal: HORIZONTAL_MARGIN }]}
        onLayout={(e: LayoutChangeEvent) => setPillWidth(e.nativeEvent.layout.width)}
      >
        <GlassSurface tintColor={tintColor} />

        <Animated.View
          pointerEvents="none"
          style={[styles.indicator, indicatorStyle]}
        />

        <View style={styles.tabsRow}>
          {visibleRoutes.map((route, index) => {
            const { options } = descriptors[route.key];
            const isFocused = index === focusedIndex;
            const label = (options.tabBarLabel ?? options.title ?? route.name) as string;
            const color = isFocused ? activeColor : inactiveColor;

            const onPress = () => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name, route.params);
              }
            };

            const onLongPress = () => {
              navigation.emit({ type: 'tabLongPress', target: route.key });
            };

            return (
              <TabButton
                key={route.key}
                label={label}
                color={color}
                isFocused={isFocused}
                onPress={onPress}
                onLongPress={onLongPress}
                renderIcon={options.tabBarIcon}
              />
            );
          })}
        </View>
      </View>
    </View>
  );
}

type TabButtonProps = {
  label: string;
  color: string;
  isFocused: boolean;
  onPress: () => void;
  onLongPress: () => void;
  renderIcon?: (props: { focused: boolean; color: string; size: number }) => React.ReactNode;
};

function TabButton({ label, color, isFocused, onPress, onLongPress, renderIcon }: TabButtonProps) {
  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withTiming(isFocused ? 1 : 0.94, TIMING) }],
  }));

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityState={isFocused ? { selected: true } : { selected: false }}
      accessibilityLabel={label}
      hitSlop={8}
      style={styles.tabItem}
    >
      <Animated.View style={[styles.tabContent, contentStyle]}>
        {renderIcon ? renderIcon({ focused: isFocused, color, size: 22 }) : null}
        <Text numberOfLines={1} style={[typography.eyebrow, styles.label, { color }]}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

function GlassSurface({ tintColor }: { tintColor?: string }) {
  if (isLiquidGlassAvailable()) {
    return (
      <GlassView
        glassEffectStyle="clear"
        isInteractive
        tintColor={tintColor}
        style={StyleSheet.absoluteFill}
      />
    );
  }

  return (
    <View style={StyleSheet.absoluteFill}>
      <BlurView
        intensity={Platform.OS === 'android' ? 80 : 60}
        tint="systemUltraThinMaterialLight"
        experimentalBlurMethod="dimezisBlurView"
        style={StyleSheet.absoluteFill}
      />
      <View style={[StyleSheet.absoluteFill, styles.surfaceTint]} pointerEvents="none" />
      <View style={[StyleSheet.absoluteFill, styles.highlight]} pointerEvents="none" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  pillWrapper: {
    height: PILL_HEIGHT,
    borderRadius: PILL_RADIUS,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(97,74,68,0.10)',
    ...shadowLgDark,
  },
  surfaceTint: {
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  highlight: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.7)',
    borderRadius: PILL_RADIUS,
  },
  indicator: {
    position: 'absolute',
    top: PILL_INSET,
    bottom: PILL_INSET,
    left: 0,
    borderRadius: PILL_RADIUS - PILL_INSET,
    backgroundColor: color_pallet.elevated.dark,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(167,203,242,0.45)',
    shadowColor: '#3C78BE',
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  tabsRow: {
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: PILL_INSET,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  tabContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  label: {
    fontSize: 10,
    letterSpacing: 0.6,
  },
});

export default LiquidGlassTabBar;
