import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PressableScale } from './PressableScale';

interface InboxHeaderButtonProps {
  count: number;
  onPress: () => void;
}

/**
 * Header button shown on every tab, badged with how many captured
 * notifications are still waiting to be confirmed or discarded. Extracted
 * out of app/(app)/_layout.tsx so a screen with its own headerRight override
 * (Categorías' "+ Nueva categoría") can still render this alongside it,
 * instead of silently losing it -- see useMovementModal's openInbox/
 * pendingCount.
 */
export function InboxHeaderButton({ count, onPress }: InboxHeaderButtonProps) {
  return (
    <PressableScale
      onPress={onPress}
      className="mr-4"
      accessibilityRole="button"
      accessibilityLabel="Notificaciones pendientes"
    >
      <View>
        <Ionicons name="mail-unread-outline" size={24} color="#ffffff" />
        {count > 0 && (
          <View
            className="absolute -top-1.5 -right-2 bg-danger rounded-full items-center justify-center px-1"
            style={{ minWidth: 16, height: 16 }}
          >
            <Text className="text-white text-[10px] font-jakarta-bold">{count > 9 ? '9+' : count}</Text>
          </View>
        )}
      </View>
    </PressableScale>
  );
}
