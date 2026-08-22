import { Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { PressableScale } from './PressableScale';

interface CategoryFilterToastProps {
  categoryName: string;
  onReset: () => void;
}

/**
 * Persistent floating pill shown whenever Movimientos is filtered by a
 * category (arriving from a tap on Resumen, or picked directly from the
 * filter sheet) -- unlike a regular toast, this does NOT auto-dismiss on a
 * timer: it stays up for as long as the filter itself is active, since it's
 * a statement of current state ("this list is filtered"), not a one-off
 * notification. Its own "Restablecer" clears the filter (same action as
 * clearing it from the filter sheet), which is what makes the pill go away.
 *
 * No `exiting` animation on purpose: the underlying data (activeCategoryId)
 * already clears instantly the moment this unmounts -- a Reanimated
 * FadeOut here used to keep this pill visibly rendered for its own 200ms
 * duration AFTER the list behind it had already gone back to unfiltered,
 * which read as "the filter didn't clear" when the unmount happened to
 * overlap a fast tab switch (confirmed on a 0.25x slow-motion capture:
 * the pill was still fading out on a screen the list had already left).
 * Dismissing in the same frame the state actually changes keeps the pill
 * truthful about what's on screen, at the cost of a less soft exit.
 */
export function CategoryFilterToast({ categoryName, onReset }: CategoryFilterToastProps) {
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 24, right: 24, bottom: 16, alignItems: 'center' }}>
      <Animated.View
        entering={FadeIn.duration(200)}
        className="bg-gray-900 flex-row items-center px-4 py-2.5 rounded-full"
        style={{ maxWidth: '100%' }}
      >
        <Text className="text-white text-sm font-jakarta-medium flex-shrink" numberOfLines={1}>
          Filtrando movimientos por: {categoryName}
        </Text>
        <PressableScale
          onPress={onReset}
          hitSlop={8}
          className="ml-3"
          accessibilityRole="button"
          accessibilityLabel="Restablecer filtro"
        >
          <Text className="text-blue-300 text-sm font-jakarta-semibold underline">Restablecer</Text>
        </PressableScale>
      </Animated.View>
    </View>
  );
}
