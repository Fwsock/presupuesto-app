import { useRef } from 'react';
import { ActivityIndicator, Animated, Pressable, Text, View } from 'react-native';

interface ButtonProps {
  title: string;
  onPress: () => void;
  loading?: boolean;
  loadingLabel?: string;
  disabled?: boolean;
  variant?: 'primary' | 'ghost';
}

/**
 * Shared button with an immediate press animation (scale down) and a visible
 * loading state for async actions. Every form button in the app uses this so
 * the feedback is consistent across screens.
 */
export function Button({
  title,
  onPress,
  loading = false,
  loadingLabel = 'Guardando...',
  disabled = false,
  variant = 'primary',
}: ButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const isDisabled = disabled || loading;

  const animateTo = (to: number) => {
    Animated.timing(scale, { toValue: to, duration: 90, useNativeDriver: true }).start();
  };

  const isPrimary = variant === 'primary';
  const pressableClass = [
    isPrimary ? 'bg-blue-600 rounded-md py-3 mt-2 mb-2' : 'py-2 mb-4',
    'items-center justify-center',
    isDisabled ? 'opacity-60' : '',
  ].join(' ');

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        disabled={isDisabled}
        onPressIn={() => !isDisabled && animateTo(0.97)}
        onPressOut={() => animateTo(1)}
        className={pressableClass}
        accessibilityRole="button"
      >
        {loading ? (
          <View className="flex-row items-center justify-center">
            <ActivityIndicator size="small" color={isPrimary ? '#fff' : '#6b7280'} />
            <Text className={`ml-2 text-center font-semibold ${isPrimary ? 'text-white' : 'text-gray-500'}`}>
              {loadingLabel}
            </Text>
          </View>
        ) : (
          <Text className={`text-center font-semibold ${isPrimary ? 'text-white' : 'text-gray-500'}`}>{title}</Text>
        )}
      </Pressable>
    </Animated.View>
  );
}
