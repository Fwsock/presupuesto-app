import { useEffect, useRef } from 'react';
import { Animated, View, type ViewStyle } from 'react-native';

interface SkeletonBlockProps {
  width: number | `${number}%`;
  height: number;
  borderRadius?: number;
  style?: ViewStyle;
}

/**
 * A single pulsing placeholder block. Ultra-light fill (`#EEF2F6`, close to
 * the page's own `bg-background`) and a soft opacity range (0.5-0.85, never
 * near-solid) -- a stronger gray/wider pulse used to read as a harsh flash
 * right before the real content painted, exactly what this is meant to
 * avoid.
 */
function SkeletonBlock({ width, height, borderRadius = 6, style }: SkeletonBlockProps) {
  const opacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.85, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[{ width, height, borderRadius, backgroundColor: '#EEF2F6', opacity }, style]}
    />
  );
}

/**
 * Loading placeholder for Resumen's main content -- three card-shaped
 * blocks (chart / balance / category list), matching the real cards'
 * position, width and rounded-2xl silhouette (see .claude/skills/
 * ui-ux-design) so the swap from skeleton to real data doesn't jump in
 * size or shape, just fades from a soft placeholder to the actual card.
 * No border/shadow on these -- a real card's hairline border + shadow
 * appearing on top of an already-card-shaped block reads as a much smaller
 * change than a whole bordered shell materializing out of nothing.
 */
export function ScreenSkeleton() {
  return (
    <View className="pt-2">
      <SkeletonBlock width="100%" height={168} borderRadius={16} style={{ marginHorizontal: 16, marginTop: 16 }} />
      <SkeletonBlock width="100%" height={168} borderRadius={16} style={{ marginHorizontal: 16, marginTop: 16 }} />
      <SkeletonBlock width="100%" height={264} borderRadius={16} style={{ marginHorizontal: 16, marginTop: 16 }} />
    </View>
  );
}
