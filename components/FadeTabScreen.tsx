import { useEffect } from 'react';
import { useIsFocused } from '@react-navigation/native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

interface FadeTabScreenProps {
  children: React.ReactNode;
}

/**
 * Wraps a tab screen's root content with a soft opacity fade-in whenever
 * this tab becomes focused. react-navigation's bottom-tabs keeps every tab
 * screen mounted and just toggles a `display: none`/`flex` style on the
 * unfocused ones -- an instant, jarring swap with no transition of its own.
 * This adds a ~220ms fade so switching tabs feels less abrupt, without
 * touching the tab bar or navigation logic itself.
 */
export function FadeTabScreen({ children }: FadeTabScreenProps) {
  const isFocused = useIsFocused();
  const opacity = useSharedValue(isFocused ? 1 : 0);

  useEffect(() => {
    opacity.value = isFocused ? withTiming(1, { duration: 220 }) : 0;
  }, [isFocused, opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return <Animated.View style={[{ flex: 1 }, style]}>{children}</Animated.View>;
}
