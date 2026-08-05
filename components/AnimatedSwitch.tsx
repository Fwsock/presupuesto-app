import { useEffect } from 'react';
import { Pressable } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

const TRACK_WIDTH = 46;
const TRACK_HEIGHT = 26;
const THUMB_SIZE = 22;
const THUMB_MARGIN = 2;
const TRAVEL = TRACK_WIDTH - THUMB_SIZE - THUMB_MARGIN * 2;

interface AnimatedSwitchProps {
  value: boolean;
  onValueChange: () => void;
  disabled?: boolean;
}

/**
 * Fully custom on/off switch (Reanimated-driven, no RN core `Switch`) so its
 * touch target and slide animation are entirely ours to control. The native
 * `Switch` has platform-defined touch padding that isn't configurable and
 * was bleeding into the neighboring edit button's hitSlop, plus its own
 * internal thumb animation could visibly stall when the row re-rendered
 * mid-slide (e.g. list reordering). This has a fixed, small hitSlop and
 * animates a single shared value on the UI thread.
 */
export function AnimatedSwitch({ value, onValueChange, disabled = false }: AnimatedSwitchProps) {
  const progress = useSharedValue(value ? 1 : 0);
  useEffect(() => {
    progress.value = withTiming(value ? 1 : 0, { duration: 200 });
  }, [value, progress]);

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], ['#d1d5db', '#16a34a']),
  }));
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * TRAVEL }],
  }));

  return (
    <Pressable
      onPress={onValueChange}
      disabled={disabled}
      hitSlop={6}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      style={{ opacity: disabled ? 0.6 : 1 }}
    >
      <Animated.View
        style={[
          {
            width: TRACK_WIDTH,
            height: TRACK_HEIGHT,
            borderRadius: TRACK_HEIGHT / 2,
            padding: THUMB_MARGIN,
            justifyContent: 'center',
          },
          trackStyle,
        ]}
      >
        <Animated.View
          style={[
            { width: THUMB_SIZE, height: THUMB_SIZE, borderRadius: THUMB_SIZE / 2, backgroundColor: '#ffffff' },
            thumbStyle,
          ]}
        />
      </Animated.View>
    </Pressable>
  );
}
