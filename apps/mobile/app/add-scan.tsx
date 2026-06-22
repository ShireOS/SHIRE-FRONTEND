import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgLinearGradient,
  Mask,
  Pattern,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import type { Room } from '@shire/db';

import PlushyButton from '@/components/PlushyButton';
import { color_pallet } from '@/styles/colors';
import { typography } from '@/styles/typography';
import { shadowMd } from '@/styles/shadows';

const DUMMY_ROOMS: Room[] = [
  { id: 1, restaraunt_id: null, room_name: 'Main Dining Room', table_scan_id: null },
  { id: 2, restaraunt_id: null, room_name: 'Patio', table_scan_id: null },
  { id: 3, restaraunt_id: null, room_name: 'Private Lounge', table_scan_id: null },
  { id: 4, restaraunt_id: null, room_name: 'Bar', table_scan_id: null },
  { id: 5, restaraunt_id: null, room_name: 'Mezzanine', table_scan_id: null },
];

const EYEBROW_LABEL = {
  ...typography.eyebrow,
  color: color_pallet.ink[500],
};

export default function AddScan() {
  const router = useRouter();
  const roomOptions: Room[] = useMemo(() => DUMMY_ROOMS, []);

  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [scanName, setScanName] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [anchor, setAnchor] = useState<
    { x: number; y: number; width: number } | null
  >(null);
  const triggerRef = useRef<View>(null);

  const openPicker = () => {
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ x, y: y + height + 8, width });
      setPickerOpen(true);
    });
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  const handleStartScan = () => {
    console.warn('Start scan not implemented yet');
    // TODO: navigate to the 3D scan capture screen
  };

  const pickRoom = (room: Room) => {
    setSelectedRoom(room);
    setPickerOpen(false);
  };

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={{ flex: 1, backgroundColor: color_pallet.cream[50] }}
    >
      <DottedSkyBackground />

      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 20,
          paddingTop: 4,
          paddingBottom: 12,
          marginBottom: 10
        }}
      >
        <Pressable
          onPress={handleBack}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={({ pressed }) => ({
            width: 40,
            height: 40,
            borderRadius: 9999,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: pressed ? color_pallet.cream[200] : 'transparent',
          })}
        >
          <Feather name="arrow-left" size={22} color={color_pallet.ink[900]} />
        </Pressable>
        <Text
          style={[
            typography.h3,
            {
              color: color_pallet.ink[900],
            },
          ]}
        >
          Add Scan
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Form */}
      <View style={{ paddingHorizontal: 20, gap: 16 }}>
        {/* Room picker — matches the Number-of-tables input shell */}
        <View style={{ gap: 8 }}>
          <Text
            style={[
              EYEBROW_LABEL,
              selectedRoom ? { color: color_pallet.sky[700] } : null,
            ]}
          >
            Room
          </Text>
          <View ref={triggerRef} collapsable={false}>
            <Pressable
              onPress={openPicker}
              accessibilityRole="button"
              accessibilityLabel="Select room"
              accessibilityState={{ expanded: pickerOpen }}
              style={{
                height: 52,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: selectedRoom
                  ? color_pallet.sky[700]
                  : color_pallet.stone[200],
                backgroundColor: color_pallet.cream[100],
                paddingHorizontal: 16,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Text
                style={{
                  fontFamily: 'Inter_400Regular',
                  fontSize: 16,
                  color: selectedRoom ? color_pallet.ink[900] : color_pallet.ink[500],
                  flexShrink: 1,
                }}
                numberOfLines={1}
              >
                {selectedRoom?.room_name ?? 'Select a room'}
              </Text>
              <View
                style={{
                  transform: [{ rotate: pickerOpen ? '180deg' : '0deg' }],
                }}
              >
                <Feather
                  name="chevron-down"
                  size={18}
                  color={color_pallet.ink[500]}
                />
              </View>
            </Pressable>
          </View>
        </View>

        {/* Number of tables */}
        <View style={{ gap: 8 }}>
          <Text
            style={[
              EYEBROW_LABEL,
              scanName ? { color: color_pallet.sky[700] } : null,
            ]}
          >
            Scan Name
          </Text>
          <View
            style={{
              height: 52,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: scanName
                ? color_pallet.sky[700]
                : color_pallet.stone[200],
              backgroundColor: color_pallet.cream[100],
              paddingHorizontal: 16,
              justifyContent: 'center',
            }}
          >
            <TextInput
              value={scanName}
              onChangeText={setScanName}
              placeholder="e.g. Friday dinner service"
              placeholderTextColor={color_pallet.ink[500]}
              style={{
                fontFamily: 'Inter_400Regular',
                fontSize: 16,
                color: scanName ? color_pallet.ink[900] : color_pallet.ink[500],
              }}
            />
          </View>
        </View>
      </View>

      {/* Camera preview card */}
      <View
        style={{
          flex: 1,
          paddingHorizontal: 20,
          paddingTop: 24,
          paddingBottom: 28,
        }}
      >
        <View
          style={[
            {
              flex: 1,
              borderRadius: 24,
              overflow: 'hidden',
              backgroundColor: color_pallet.ink[900],
              borderWidth: 1,
              borderColor: color_pallet.stone[200],
            },
            shadowMd,
          ]}
        >
          {/* Simulated camera feed — replace with real preview later */}
          <LinearGradient
            colors={['#1A1615', '#221E1D', '#0F0D0D']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          />
          {/* Subtle sky vignette for premium feel */}
          <LinearGradient
            colors={['rgba(132,185,239,0.18)', 'transparent']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 0.6 }}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          />

         

          {/* Blurred haze + CTA */}
          <View
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 0,
              bottom: 0,
              alignItems: 'center',
              justifyContent: 'center',
            }}
            pointerEvents="box-none"
          >
            <BlurView
              intensity={32}
              tint="dark"
              style={{
                paddingHorizontal: 24,
                paddingVertical: 20,
                borderRadius: 28,
                overflow: 'hidden',
                alignItems: 'center',
                gap: 14,
                maxWidth: 280,
              }}
            >
              <PlushyButton
                onPress={handleStartScan}
                accessibilityLabel="Start 3D scan"
                style={{
                  marginTop: 4,
                  paddingHorizontal: 22,
                  paddingVertical: 12,
                  borderRadius: 9999,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 14,
                }}
              >
                <Feather
                  name="camera"
                  size={20}
                  color={color_pallet.bg.DEFAULT}
                />
                <Text
                  style={[
                    typography.title,
                    { color: color_pallet.bg.DEFAULT },
                  ]}
                >
                  Start 3D scan
                </Text>
              </PlushyButton>
            </BlurView>
          </View>
        </View>
      </View>

      {/* Room picker — anchored shadcn-style dropdown */}
      <RoomDropdownMenu
        open={pickerOpen}
        anchor={anchor}
        rooms={roomOptions}
        selectedId={selectedRoom?.id ?? null}
        onSelect={pickRoom}
        onClose={() => setPickerOpen(false)}
      />
    </SafeAreaView>
  );
}

/**
 * Anchored, shadcn-style dropdown menu translated to React Native primitives.
 * Visual rules from design.md §6 / §7 "Dropdown panel": white surface, hairline
 * stone-200 border, cool sky shadow, compact rows with leading icon + sky-700
 * check on selection. Anchored under the trigger (measureInWindow).
 *
 * Motion (UI Pro Max §7): 220ms ease-out enter, 140ms ease-in exit (~64%).
 * Stagger each row by 28ms for a crafted reveal. Items use 44pt min-height
 * (touch target). prefers-reduced-motion → opacity only, no transforms.
 */
export function RoomDropdownMenu({
  open,
  anchor,
  rooms,
  selectedId,
  onSelect,
  onClose,
}: {
  open: boolean;
  anchor: { x: number; y: number; width: number } | null;
  rooms: Room[];
  selectedId: number | null;
  onSelect: (room: Room) => void;
  onClose: () => void;
}) {
  const screen = Dimensions.get('window');
  const panelLeft = anchor?.x ?? 0;
  const panelTop = anchor?.y ?? 0;
  const panelWidth = anchor?.width ?? 0;
  const panelMaxHeight = Math.min(
    320,
    Math.max(160, screen.height - panelTop - 24),
  );

  // Reduced-motion preference (a11y)
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (mounted) setReduceMotion(v);
    });
    const sub = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (v) => setReduceMotion(v),
    );
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  // Reveal progress drives both panel and per-row entry.
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(open ? 1 : 0, {
      duration: open ? 220 : 140,
      easing: open ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
    });
  }, [open, progress]);

  const panelAnimStyle = useAnimatedStyle(() => {
    if (reduceMotion) {
      return { opacity: progress.value };
    }
    return {
      opacity: progress.value,
      transform: [
        { translateY: (1 - progress.value) * -6 },
        { scale: 0.97 + progress.value * 0.03 },
      ],
    };
  }, [reduceMotion]);

  return (
    <Modal
      visible={open}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable
        onPress={onClose}
        style={{ flex: 1, backgroundColor: 'transparent' }}
      >
        {anchor ? (
          <Animated.View
            // Transform origin "top" so scale grows out from the trigger edge.
            style={[
              {
                position: 'absolute',
                left: panelLeft,
                top: panelTop,
                width: panelWidth,
                transformOrigin: 'top center',
              },
              panelAnimStyle,
            ]}
          >
            <View
              accessibilityRole="menu"
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 20,
                borderWidth: 1,
                borderColor: color_pallet.stone[200],
                paddingVertical: 8,
                overflow: 'hidden',
                // Cool sky shadow — design.md §6 dropdown panel
                shadowColor: '#3C78BE',
                shadowOpacity: 0.16,
                shadowRadius: 42,
                shadowOffset: { width: 0, height: 18 },
                elevation: 12,
              }}
            >
              <ScrollView
                style={{ maxHeight: panelMaxHeight }}
                showsVerticalScrollIndicator={false}
              >
                <View style={{ paddingHorizontal: 6 }}>
                  {rooms.map((room) => {
                    const isSelected = selectedId === room.id;
                    return (
                      <Pressable
                        key={room.id}
                        onPress={() => onSelect(room)}
                        accessibilityRole="menuitem"
                        accessibilityLabel={room.room_name ?? 'Untitled room'}
                        accessibilityState={{ selected: isSelected }}
                        style={{
                          minHeight: 44,
                          paddingHorizontal: 12,
                          paddingVertical: 10,
                          borderRadius: 10,
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 12,
                          backgroundColor: 'transparent',
                        }}
                      >
                        <View
                          style={{
                            width: 3,
                            height: 18,
                            borderRadius: 2,
                            backgroundColor: isSelected
                              ? color_pallet.sky[700]
                              : 'transparent',
                          }}
                        />
                        <Feather
                          name="map-pin"
                          size={14}
                          color={
                            isSelected
                              ? color_pallet.sky[700]
                              : color_pallet.ink[500]
                          }
                        />
                        <Text
                          style={{
                            color: isSelected
                              ? color_pallet.sky[700]
                              : color_pallet.ink[900],
                            fontSize: 14,
                            fontFamily: isSelected
                              ? 'Inter_500Medium'
                              : 'Inter_400Regular',
                            flex: 1,
                          }}
                          numberOfLines={1}
                        >
                          {room.room_name ?? 'Untitled room'}
                        </Text>
                        {isSelected && (
                          <Feather
                            name="check"
                            size={15}
                            color={color_pallet.sky[700]}
                          />
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
          </Animated.View>
        ) : null}
      </Pressable>
    </Modal>
  );
}

function DottedSkyBackground() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
        <Defs>
          {/* Dot grid — 22×22, faint stone dot. Darker base; the mask fades them upward. */}
          <Pattern
            id="dotGrid"
            x={0}
            y={0}
            width={22}
            height={22}
            patternUnits="userSpaceOnUse"
          >
            <Circle cx={1} cy={1} r={1.1} fill="#9CA0A6" opacity={0.95} />
          </Pattern>

          {/* Top→bottom fade for the dot mask — faint but visible at the top, fully visible near the bottom */}
          <SvgLinearGradient id="dotFade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.3} />
            <Stop offset="35%" stopColor="#FFFFFF" stopOpacity={0.45} />
            <Stop offset="65%" stopColor="#FFFFFF" stopOpacity={0.7} />
            <Stop offset="100%" stopColor="#FFFFFF" stopOpacity={1} />
          </SvgLinearGradient>

          <Mask id="dotFadeMask" maskUnits="userSpaceOnUse">
            <Rect width="100%" height="100%" fill="url(#dotFade)" />
          </Mask>

          {/* SMOOTHED: Soft sky glow centered low — primary bloom */}
          <RadialGradient
            id="skyBloomBottom"
            cx="50%"
            cy="100%"
            rx="100%" /* Slightly wider radius to ease the transition edge */
            ry="85%"  /* Slightly taller radius to stretch the blend upward */
            fx="50%"
            fy="100%"
          >
            <Stop offset="0%" stopColor="#84B9EF" stopOpacity={0.7} />
            <Stop offset="30%" stopColor="#9BC5F0" stopOpacity={0.45} />
            <Stop offset="55%" stopColor="#BBD6F3" stopOpacity={0.25} />
            <Stop offset="75%" stopColor="#DCE9F6" stopOpacity={0.12} />
            <Stop offset="90%" stopColor="#F2F6FA" stopOpacity={0.03} />
            <Stop offset="100%" stopColor="#FAFAFA" stopOpacity={0} />
          </RadialGradient>

          {/* Subtle warm wash from the top, keeps cream feeling alive */}
          <RadialGradient
            id="creamWashTop"
            cx="50%"
            cy="0%"
            rx="90%"
            ry="55%"
            fx="50%"
            fy="0%"
          >
            <Stop offset="0%" stopColor="#F4F1EE" stopOpacity={0.55} />
            <Stop offset="100%" stopColor="#FAFAFA" stopOpacity={0} />
          </RadialGradient>
        </Defs>

        {/* Cream canvas base */}
        <Rect width="100%" height="100%" fill="#FAFAFA" />
        {/* Warm wash */}
        <Rect width="100%" height="100%" fill="url(#creamWashTop)" />
        {/* Dot grid — masked so dots fade in toward the bottom */}
        <Rect
          width="100%"
          height="100%"
          fill="url(#dotGrid)"
          mask="url(#dotFadeMask)"
        />
        {/* Sky bloom on top of the dots so the glow hides them slightly */}
        <Rect width="100%" height="100%" fill="url(#skyBloomBottom)" />
      </Svg>
    </View>
  );
}