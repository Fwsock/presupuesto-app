import { useRef } from 'react';
import { Animated, Pressable, Text } from 'react-native';
import { Link, type Href } from 'expo-router';

interface TextLinkProps {
  href: Href;
  children: string;
  className?: string;
}

/**
 * Centered text-only link with a clearly perceptible pressed state: scales
 * down slightly (matching PressableScale's feel, used everywhere else for
 * tap feedback) AND shows a subtle light-blue border while held, both
 * releasing back to normal on lift. The border stays on top of the scale
 * dip rather than replacing it -- a scale-only cue reads as an obvious
 * button, but these are secondary text actions, so the border keeps them
 * looking like text (white background, blue text, unchanged) while still
 * making the touch unmistakable.
 */
export function TextLink({ href, children, className }: TextLinkProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const animateTo = (toValue: number) => {
    Animated.timing(scale, { toValue, duration: 90, useNativeDriver: true }).start();
  };

  return (
    <Link href={href} asChild>
      <Pressable
        accessibilityRole="button"
        hitSlop={8}
        onPressIn={() => animateTo(0.95)}
        onPressOut={() => animateTo(1)}
        className={['self-center', className].filter(Boolean).join(' ')}
      >
        {({ pressed }) => (
          <Animated.View
            style={{
              transform: [{ scale }],
              borderWidth: 1,
              borderColor: pressed ? '#bfdbfe' : 'transparent',
              borderRadius: 8,
              paddingVertical: 4,
              paddingHorizontal: 12,
            }}
          >
            <Text className="text-brand text-center">{children}</Text>
          </Animated.View>
        )}
      </Pressable>
    </Link>
  );
}
