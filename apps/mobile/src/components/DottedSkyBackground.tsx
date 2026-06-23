import {
  StyleSheet,
  View,
  type DimensionValue,
} from 'react-native';

const DOT_ROWS = 34;
const DOT_COLUMNS = 18;
const dots = Array.from({ length: DOT_ROWS * DOT_COLUMNS }, (_, index) => {
  const row = Math.floor(index / DOT_COLUMNS);
  const column = index % DOT_COLUMNS;

  return {
    key: `${row}-${column}`,
    left: `${(column / (DOT_COLUMNS - 1)) * 100}%` as DimensionValue,
    top: `${(row / (DOT_ROWS - 1)) * 100}%` as DimensionValue,
    opacity: 0.12 + (row / (DOT_ROWS - 1)) * 0.36,
  };
});

interface DottedSkyBackgroundProps {
  opacity?: number;
  glow?: boolean
}
export function DottedSkyBackground({
    opacity = 1,
    glow = true
}: DottedSkyBackgroundProps) {
  return (
    <View pointerEvents="none" style={[styles.root, { opacity: opacity ?? 1 }]}>
      <View style={styles.creamWash} />
      {dots.map((dot) => (
        <View
          key={dot.key}
          style={[
            styles.dot,
            {
              left: dot.left,
              top: dot.top,
              opacity: dot.opacity,
            },
          ]}
        />
      ))}
      {glow ? (
        <>
          <View style={styles.skyBloom} />
          <View style={styles.skyBloomSoft} />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: '#FAFAFA',
    overflow: 'hidden',
  },
  creamWash: {
    position: 'absolute',
    top: -140,
    left: -60,
    right: -60,
    height: 320,
    borderRadius: 180,
    backgroundColor: '#F4F1EE',
    opacity: 0.55,
  },
  dot: {
    position: 'absolute',
    width: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#8F969E',
  },
  skyBloom: {
    position: 'absolute',
    left: -100,
    right: -100,
    bottom: -260,
    height: 520,
    borderRadius: 260,
    backgroundColor: '#9BC5F0',
    opacity: 0.28,
  },
  skyBloomSoft: {
    position: 'absolute',
    left: -40,
    right: -40,
    bottom: -180,
    height: 360,
    borderRadius: 180,
    backgroundColor: '#84B9EF',
    opacity: 0.18,
  },
});
