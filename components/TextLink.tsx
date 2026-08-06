import { Pressable, Text } from 'react-native';
import { Link, type Href } from 'expo-router';

interface TextLinkProps {
  href: Href;
  children: string;
  className?: string;
}

/**
 * Centered text-only link with a subtle bordered "pressed" state (a thin
 * light-blue border that appears only while held, gone on release) instead
 * of PressableScale's scale/opacity feedback used everywhere else -- these
 * are secondary text actions (auth screen navigation), not primary buttons,
 * so a lighter-weight cue fits better than the scale-down treatment.
 */
export function TextLink({ href, children, className }: TextLinkProps) {
  return (
    <Link href={href} asChild>
      <Pressable
        accessibilityRole="button"
        hitSlop={8}
        className={['self-center rounded-lg px-3 py-1', className].filter(Boolean).join(' ')}
        style={({ pressed }) => ({
          borderWidth: 1,
          borderColor: pressed ? '#bfdbfe' : 'transparent',
        })}
      >
        <Text className="text-blue-600 text-center">{children}</Text>
      </Pressable>
    </Link>
  );
}
