import {
  View,
} from 'react-native';
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

interface DottedSkyBackgroundProps {
  opacity?: number;
  glow?: boolean
}
export function DottedSkyBackground({
    opacity = 1,
    glow = true
}: DottedSkyBackgroundProps) {
  return (
    <View pointerEvents="none" style={{
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    opacity: opacity ?? 100
  }}>
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
        {glow ?? <Rect opacity="1" width="100%" height="100%" fill="url(#skyBloomBottom)" />}
      </Svg>
    </View>
  );
}
