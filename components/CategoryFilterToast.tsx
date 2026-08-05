import { Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
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
 */
export function CategoryFilterToast({ categoryName, onReset }: CategoryFilterToastProps) {
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 24, right: 24, bottom: 16, alignItems: 'center' }}>
      <Animated.View
        entering={FadeIn.duration(200)}
        exiting={FadeOut.duration(200)}
        className="bg-gray-900 flex-row items-center px-4 py-2.5 rounded-full"
        style={{ maxWidth: '100%' }}
      >
        <Text className="text-white text-sm font-medium flex-shrink" numberOfLines={1}>
          Filtrando movimientos por: {categoryName}
        </Text>
        <PressableScale
          onPress={onReset}
          hitSlop={8}
          className="ml-3"
          accessibilityRole="button"
          accessibilityLabel="Restablecer filtro"
        >
          <Text className="text-blue-300 text-sm font-semibold underline">Restablecer</Text>
        </PressableScale>
      </Animated.View>
    </View>
  );
}
