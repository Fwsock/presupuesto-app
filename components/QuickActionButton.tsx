import { ActivityIndicator, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PressableScale } from './PressableScale';
import { theme } from '../lib/theme';

/** Extracted out of PendingNotificationsInbox so FeedbackForm's "adjuntar evidencia" buttons can share the exact same look, instead of a second hand-copied version. */
export function QuickActionButton({
  icon,
  label,
  onPress,
  loading = false,
  disabled = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled || loading}
      scaleTo={0.965}
      activeOpacity={0.7}
      spring
      haptics
      className="flex-1 items-center justify-center border border-gray-200 rounded-2xl py-5 px-2"
      style={{ opacity: disabled && !loading ? 0.5 : 1 }}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View className="w-12 h-12 rounded-full bg-brand/10 items-center justify-center mb-2">
        {loading ? (
          <ActivityIndicator size="small" color={theme.brand} />
        ) : (
          <Ionicons name={icon} size={22} color={theme.brand} />
        )}
      </View>
      <Text className="text-sm font-jakarta-medium text-center">{label}</Text>
    </PressableScale>
  );
}
