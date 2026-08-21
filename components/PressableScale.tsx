import { useRef } from 'react';
import { Animated, Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';

interface PressableScaleProps extends Omit<PressableProps, 'style'> {
  children: React.ReactNode;
  scaleTo?: number;
  /**
   * Opacity while pressed. Defaults to 0.6 -- a fairly strong dip, right for
   * a small icon-only touch target (nav arrows, edit/delete icons). A
   * full-width row/card reads that same 0.6 as an abrupt flash rather than
   * subtle feedback -- pass something gentler (0.7-0.85) for those.
   */
  activeOpacity?: number;
  /**
   * Use a soft spring for the scale instead of the default linear timing --
   * better suited to a full row/card press (a gentle settle) than the
   * snappy default tuned for small buttons.
   */
  spring?: boolean;
  /** Fires a light haptic tick on press-in. Opt-in -- not every tap in the app should buzz. */
  haptics?: boolean;
  style?: StyleProp<ViewStyle>;
  className?: string;
}

/**
 * Pressable with a clearly-visible "press down" feel (scale + opacity dip),
 * used everywhere something is tappable — nav arrows, edit/delete icons,
 * filter chips, the FAB — so any future interactive element gets the same
 * feedback for free by using this instead of a plain Pressable.
 *
 * `style` and `className` both land on the inner Pressable, not the
 * Animated.View wrapper. They used to be split (style on the wrapper,
 * className on the Pressable via `...rest`), which put the sizing
 * (minWidth/minHeight) and the centering (items-center justify-center) on
 * two different elements — the wrapper had the enforced 44x44 box but no
 * alignItems/justifyContent of its own, so content sat top-left of that box
 * instead of centered. The wrapper is now a pure transform/opacity layer
 * with no layout properties of its own, so it can't interfere.
 */
export function PressableScale({
  children,
  scaleTo = 0.85,
  activeOpacity = 0.6,
  spring = false,
  haptics = false,
  onPressIn,
  onPressOut,
  style,
  className,
  ...rest
}: PressableScaleProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  const animateTo = (toScale: number, toOpacity: number) => {
    Animated.parallel([
      spring
        ? Animated.spring(scale, { toValue: toScale, useNativeDriver: true, friction: 9, tension: 120 })
        : Animated.timing(scale, { toValue: toScale, duration: 90, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: toOpacity, duration: 90, useNativeDriver: true }),
    ]).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale }], opacity }}>
      <Pressable
        {...rest}
        style={style}
        className={className}
        onPressIn={(e) => {
          if (haptics) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          animateTo(scaleTo, activeOpacity);
          onPressIn?.(e);
        }}
        onPressOut={(e) => {
          animateTo(1, 1);
          onPressOut?.(e);
        }}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}
