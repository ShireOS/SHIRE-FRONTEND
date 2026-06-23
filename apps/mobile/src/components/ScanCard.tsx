import React, { useRef } from 'react';
import { View, Text, Image, Pressable, StyleSheet, type LayoutChangeEvent } from 'react-native';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { typography } from '@/styles/typography';
import { color_pallet } from '@/styles/colors';
import type { Scan, ScanType } from '@/models/scan';

const EASE_IN_CUBIC = Easing.bezier(0.32, 0, 0.67, 0);

function alpha(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

const PILL_FOR: Record<ScanType, { label: string; color: string }> = {
  deployed: { label: 'Deployed', color: '#0EA158' },
  processing: { label: 'Processing', color: '#1A1615' },
  uploaded: { label: 'Uploaded', color: '#156CC2' },
};

export interface ScanCardProps {
  data: Scan;
  onPress?: () => void;
  onDelete: () => void;
}

export function ScanCard({ data, onPress, onDelete }: ScanCardProps) {
  const heightPx = useSharedValue(0);
  const heightFactor = useSharedValue(1);
  const opacity = useSharedValue(1);
  const measured = useRef(false);

  const onLayout = (e: LayoutChangeEvent) => {
    if (measured.current) return;
    heightPx.value = e.nativeEvent.layout.height;
    measured.current = true;
  };

  const animStyle = useAnimatedStyle(() => {
    if (heightPx.value === 0) return { opacity: opacity.value };
    return { height: heightPx.value * heightFactor.value, opacity: opacity.value, overflow: 'hidden' as const };
  });

  const handleDelete = () => {
    heightFactor.value = withTiming(0, { duration: 260, easing: EASE_IN_CUBIC }, (finished) => {
      if (finished) runOnJS(onDelete)();
    });
    opacity.value = withTiming(0, { duration: 260, easing: Easing.out(Easing.ease) });
  };

  const pill = PILL_FOR[data.type];

  return (
    <Animated.View style={animStyle} onLayout={onLayout}>
      <Pressable onPress={onPress}>
        <View style={[styles.card]}>
          <ThumbnailTile />
          <View style={styles.gap} />
          <View style={styles.body}>
            <Text numberOfLines={1} style={[typography.h3, { color: '#1A1615' }]}>
              {data.roomName}
            </Text>
            <View style={styles.spacer1} />
            <Text style={[typography.caption, { color: '#757170' }]}>
              {formatCapturedAt(data.capturedDate)}
            </Text>
            <View style={styles.spacer25} />
            <View style={[styles.pill, { backgroundColor: alpha(pill.color, 0.12) }]}>
              <View style={[styles.pillDot, { backgroundColor: pill.color }]} />
              <Text style={[typography.eyebrow, { color: pill.color }]}>{pill.label}</Text>
            </View>
          </View>
          <Pressable onPress={handleDelete} hitSlop={8} accessibilityLabel="Delete scan">
            <Feather name="trash-2" size={16} color="#C9502E" />
          </Pressable>
        </View>
      </Pressable>
    </Animated.View>
  );
}

function ThumbnailTile() {
  return (
    <View style={styles.thumb}>
      <View style={styles.thumbSurface}>
        <Image
          source={require('../../assets/images/3d-demo.png')}
          resizeMode="contain"
          style={styles.thumbImage}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: color_pallet.elevated.DEFAULT,
    borderWidth: 1,
    borderColor: color_pallet.stone[200],
    borderRadius: 6,
    padding: 16,
    flexDirection: 'row',
  },
  gap: { width: 16 },
  body: { flex: 1 },
  spacer1: { height: 4 },
  spacer25: { height: 10 },
  pill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  pillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  thumb: {
    aspectRatio: 1,
    borderRadius: 2,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(228,226,226,0.6)',
  },
  thumbSurface: { flex: 1, padding: 1, backgroundColor: '#EEF4FF' },
  thumbImage: { flex: 1, width: '100%', height: '100%' },
});

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatTime(d: Date): string {
  const h24 = d.getHours();
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const m = d.getMinutes().toString().padStart(2, '0');
  const period = h24 < 12 ? 'AM' : 'PM';
  return `${h12}:${m} ${period}`;
}

function formatCapturedAt(captured: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const that = new Date(captured.getFullYear(), captured.getMonth(), captured.getDate());
  const diffDays = Math.round((today.getTime() - that.getTime()) / (1000 * 60 * 60 * 24));
  const time = formatTime(captured);
  if (diffDays === 0) return `Today · ${time}`;
  if (diffDays === 1) return `Yesterday · ${time}`;
  if (diffDays > 1 && diffDays < 7) return `${diffDays} days ago · ${time}`;
  const month = MONTHS[captured.getMonth()];
  if (captured.getFullYear() === now.getFullYear()) return `${month} ${captured.getDate()} · ${time}`;
  return `${month} ${captured.getDate()}, ${captured.getFullYear()}`;
}

export default ScanCard;
