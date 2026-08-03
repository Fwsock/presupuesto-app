// components/FullScreenFormModal.tsx
import { Modal, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PressableScale } from './PressableScale';

interface FullScreenFormModalProps {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * Full-screen slide-up modal chrome (back arrow + title + scrollable body),
 * shared by every "open this section" screen reached from a list of
 * navigable rows (currently just Cuenta — see app/(app)/cuenta.tsx).
 */
export function FullScreenFormModal({ visible, title, onClose, children }: FullScreenFormModalProps) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-white">
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

        <ScrollView className="flex-1 px-4 pt-4" contentContainerClassName="pb-8">
          {children}
        </ScrollView>
      </View>
    </Modal>
  );
}
