import { FlatList, Modal, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AVAILABLE_MOVEMENT_ICONS } from '../features/movements/iconSuggestion';

interface IconPickerModalProps {
  visible: boolean;
  selectedIcon: string;
  onSelect: (icon: string) => void;
  onClose: () => void;
}

const NUM_COLUMNS = 5;

/** Full-screen grid to manually override the auto-suggested movement icon. */
export function IconPickerModal({ visible, selectedIcon, onSelect, onClose }: IconPickerModalProps) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-white">
        <View className="flex-row items-center px-4 py-3 border-b border-gray-100">
          <Pressable onPress={onClose} className="pr-3 py-1" accessibilityRole="button" accessibilityLabel="Volver">
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </Pressable>
          <Text className="text-lg font-semibold">Elegir ícono</Text>
        </View>

        <FlatList
          data={AVAILABLE_MOVEMENT_ICONS}
          keyExtractor={(icon) => icon}
          numColumns={NUM_COLUMNS}
          contentContainerClassName="p-4"
          renderItem={({ item: icon }) => {
            const isSelected = icon === selectedIcon;
            return (
              <Pressable
                onPress={() => {
                  onSelect(icon);
                  onClose();
                }}
                className={`flex-1 aspect-square m-1 items-center justify-center rounded-lg border ${
                  isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-200'
                }`}
                accessibilityRole="button"
                accessibilityLabel={icon}
              >
                <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={26} color={isSelected ? '#fff' : '#374151'} />
              </Pressable>
            );
          }}
        />
      </View>
    </Modal>
  );
}
