import { useEffect, useRef } from 'react';
import { Animated, View, type ViewStyle } from 'react-native';

interface SkeletonBlockProps {
  width: number | `${number}%`;
  height: number;
  borderRadius?: number;
  style?: ViewStyle;
}

/** A single pulsing gray placeholder block. */
function SkeletonBlock({ width, height, borderRadius = 6, style }: SkeletonBlockProps) {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 650, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 650, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[{ width, height, borderRadius, backgroundColor: '#e5e7eb', opacity }, style]}
    />
  );
}

/** Loading placeholder for a screen's main content — a pulsing skeleton instead of a plain "Cargando..." label. */
export function ScreenSkeleton() {
  return (
    <View className="px-4 pt-6">
      <View className="items-center mb-6">
        <SkeletonBlock width={140} height={16} style={{ marginBottom: 10 }} />
        <SkeletonBlock width={180} height={32} />
      </View>
      <View className="flex-row justify-around mb-6">
        <SkeletonBlock width={80} height={36} />
        <SkeletonBlock width={80} height={36} />
      </View>
      {[0, 1, 2, 3].map((i) => (
        <View key={i} className="flex-row items-center justify-between py-3 border-b border-gray-100">
          <SkeletonBlock width="45%" height={16} />
          <SkeletonBlock width={70} height={16} />
        </View>
      ))}
    </View>
  );
}
