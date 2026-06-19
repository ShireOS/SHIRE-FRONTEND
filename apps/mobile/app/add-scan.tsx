import React, { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
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
  const [numberOfTables, setNumberOfTables] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/scans');
    }
  };

  const handleStartScan = () => {
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
          paddingHorizontal: 20,
          paddingTop: 4,
          paddingBottom: 12,
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
              marginLeft: 8,
            },
          ]}
        >
          Add Scan
        </Text>
      </View>

      {/* Form */}
      <View style={{ paddingHorizontal: 20, gap: 16 }}>
        {/* Room picker */}
        <View style={{ gap: 8 }}>
          <Text style={EYEBROW_LABEL}>Room</Text>
          <Pressable
            onPress={() => setPickerOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Select room"
            style={({ pressed }) => ({
              height: 52,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: color_pallet.stone[200],
              backgroundColor: pressed
                ? color_pallet.cream[200]
                : color_pallet.cream[100],
              paddingHorizontal: 16,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            })}
          >
            <Text
              style={[
                typography.body,
                {
                  color: selectedRoom
                    ? color_pallet.ink[900]
                    : color_pallet.ink[500],
                },
              ]}
              numberOfLines={1}
            >
              {selectedRoom?.room_name ?? 'Select a room'}
            </Text>
            <Feather
              name="chevron-down"
              size={18}
              color={color_pallet.ink[500]}
            />
          </Pressable>
        </View>

        {/* Number of tables */}
        <View style={{ gap: 8 }}>
          <Text style={EYEBROW_LABEL}>Number of tables</Text>
          <View
            style={{
              height: 52,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: color_pallet.stone[200],
              backgroundColor: color_pallet.cream[100],
              paddingHorizontal: 16,
              justifyContent: 'center',
            }}
          >
            <TextInput
              value={numberOfTables}
              onChangeText={(t) => setNumberOfTables(t.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              inputMode="numeric"
              placeholder="0"
              placeholderTextColor={color_pallet.ink[500]}
              style={[
                typography.body,
                {
                  color: color_pallet.ink[900],
                  padding: 0,
                  fontFamily: 'FragmentMono_400Regular',
                },
              ]}
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
            shadowMd ?? {},
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
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 9999,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'rgba(255,255,255,0.16)',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.25)',
                }}
              >
                <Feather name="camera" size={26} color="#FFFFFF" />
              </View>
              <Text
                style={[
                  typography.title,
                  {
                    color: '#FFFFFF',
                    textAlign: 'center',
                  },
                ]}
              >
                Capture your room
              </Text>
              <Text
                style={[
                  typography.bodySmall,
                  {
                    color: 'rgba(255,255,255,0.75)',
                    textAlign: 'center',
                  },
                ]}
              >
                Slowly pan around the space to capture every table.
              </Text>

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
                  gap: 8,
                  backgroundColor: '#FFFFFF',
                }}
              >
                <Feather
                  name="play"
                  size={14}
                  color={color_pallet.ink[900]}
                />
                <Text
                  style={[
                    typography.title,
                    { color: color_pallet.ink[900], fontSize: 15 },
                  ]}
                >
                  Start 3D scan
                </Text>
              </PlushyButton>
            </BlurView>
          </View>
        </View>
      </View>

      {/* Room picker bottom sheet */}
      <Modal
        visible={pickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setPickerOpen(false)}
      >
        <Pressable
          onPress={() => setPickerOpen(false)}
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.25)',
            justifyContent: 'flex-end',
          }}
        >
          <Pressable
            onPress={() => {}}
            style={{
              backgroundColor: color_pallet.elevated.DEFAULT,
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              paddingHorizontal: 20,
              paddingTop: 8,
              paddingBottom: 32,
              gap: 16,
            }}
          >
            {/* Drag handle */}
            <View
              style={{
                alignSelf: 'center',
                width: 36,
                height: 4,
                borderRadius: 9999,
                backgroundColor: color_pallet.stone[200],
                marginTop: 4,
              }}
            />

            <Text style={[EYEBROW_LABEL, { paddingTop: 8 }]}>Select room</Text>

            <ScrollView
              style={{ maxHeight: 320 }}
              showsVerticalScrollIndicator={false}
            >
              <View style={{ gap: 4 }}>
                {roomOptions.map((room) => {
                  const isSelected = selectedRoom?.id === room.id;
                  return (
                    <Pressable
                      key={room.id}
                      onPress={() => pickRoom(room)}
                      style={({ pressed }) => ({
                        paddingHorizontal: 16,
                        paddingVertical: 14,
                        borderRadius: 12,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        backgroundColor: pressed
                          ? color_pallet.cream[200]
                          : isSelected
                            ? color_pallet.sky[50]
                            : 'transparent',
                      })}
                    >
                      <Text
                        style={[
                          typography.body,
                          {
                            color: color_pallet.ink[900],
                            fontFamily: isSelected
                              ? 'Inter_500Medium'
                              : 'Inter_400Regular',
                          },
                        ]}
                      >
                        {room.room_name ?? 'Untitled room'}
                      </Text>
                      {isSelected && (
                        <Feather
                          name="check"
                          size={18}
                          color={color_pallet.sky[700]}
                        />
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function DottedSkyBackground() {
  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
    >
      <Svg
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid slice"
      >
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

          {/* Soft sky glow centered low — primary bloom */}
          <RadialGradient
            id="skyBloomBottom"
            cx="50%"
            cy="100%"
            rx="90%"
            ry="78%"
            fx="50%"
            fy="100%"
          >
            <Stop offset="0%" stopColor="#84B9EF" stopOpacity={0.7} />
            <Stop offset="35%" stopColor="#A7CBF2" stopOpacity={0.45} />
            <Stop offset="70%" stopColor="#E2ECF5" stopOpacity={0.18} />
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

function ScanCorners() {
  const size = 28;
  const stroke = 2;
  const inset = 16;
  const color = 'rgba(255,255,255,0.55)';
  const baseCorner = {
    position: 'absolute' as const,
    width: size,
    height: size,
    borderColor: color,
  };
  return (
    <>
      <View
        style={{
          ...baseCorner,
          top: inset,
          right: inset,
          borderTopWidth: stroke,
          borderRightWidth: stroke,
          borderTopRightRadius: 8,
        }}
      />
      <View
        style={{
          ...baseCorner,
          bottom: inset,
          left: inset,
          borderBottomWidth: stroke,
          borderLeftWidth: stroke,
          borderBottomLeftRadius: 8,
        }}
      />
      <View
        style={{
          ...baseCorner,
          bottom: inset,
          right: inset,
          borderBottomWidth: stroke,
          borderRightWidth: stroke,
          borderBottomRightRadius: 8,
        }}
      />
      <View
        style={{
          ...baseCorner,
          top: inset,
          left: inset,
          borderTopWidth: stroke,
          borderLeftWidth: stroke,
          borderTopLeftRadius: 8,
        }}
      />
    </>
  );
}
