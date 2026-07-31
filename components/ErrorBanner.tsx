import { View, Text, Pressable } from 'react-native';

interface ErrorBannerProps {
  message: string;
  onRetry: () => void;
  /** Label for the action button. Use "Descartar" when the handler only dismisses. */
  actionLabel?: string;
}

export function ErrorBanner({ message, onRetry, actionLabel = 'Reintentar' }: ErrorBannerProps) {
  return (
    <View className="bg-red-50 border border-red-200 rounded-md px-4 py-3 mx-4 my-2 flex-row items-center justify-between">
      <Text className="text-red-700 flex-1 mr-3">{message}</Text>
      <Pressable onPress={onRetry}>
        <Text className="text-red-700 font-semibold">{actionLabel}</Text>
      </Pressable>
    </View>
  );
}
