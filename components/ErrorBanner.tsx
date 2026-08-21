import { Text } from 'react-native';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import { PressableScale } from './PressableScale';

interface ErrorBannerProps {
  message: string;
  onRetry: () => void;
  /** Label for the action button. Use "Descartar" when the handler only dismisses. */
  actionLabel?: string;
}

export function ErrorBanner({ message, onRetry, actionLabel = 'Reintentar' }: ErrorBannerProps) {
  return (
    <Animated.View
      entering={FadeInDown.duration(300)}
      exiting={FadeOutUp.duration(250)}
      className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mx-4 my-2 flex-row items-center justify-between"
    >
      <Text className="text-red-700 flex-1 mr-3">{message}</Text>
      <PressableScale onPress={onRetry} hitSlop={8}>
        <Text className="text-red-700 font-semibold">{actionLabel}</Text>
      </PressableScale>
    </Animated.View>
  );
}
