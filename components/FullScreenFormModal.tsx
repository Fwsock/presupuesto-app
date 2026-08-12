import { ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PressableScale } from './PressableScale';
import { AnimatedBottomSheet } from './AnimatedBottomSheet';

interface FullScreenFormModalProps {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * Compact bottom-sheet-style modal chrome (back arrow + title + scrollable
 * body), shared by every "open this section" screen reached from a list of
 * navigable rows (currently just Cuenta — see app/(app)/cuenta.tsx). Sized
 * to its content (capped at 85% of the screen) instead of stretching
 * full-screen — a short form like "Información personal" used to leave a
 * huge empty area below it when presented edge-to-edge.
 */
export function FullScreenFormModal({ visible, title, onClose, children }: FullScreenFormModalProps) {
  return (
    <AnimatedBottomSheet visible={visible} onClose={onClose}>
      <View className="flex-row items-center px-4 py-3 border-b border-gray-100">
        <PressableScale
          onPress={onClose}
          className="pr-3 py-1"
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
        >
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </PressableScale>
        <Text className="text-lg font-semibold">{title}</Text>
      </View>

      <ScrollView className="px-4 pt-4" contentContainerClassName="pb-8" keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </AnimatedBottomSheet>
  );
}
