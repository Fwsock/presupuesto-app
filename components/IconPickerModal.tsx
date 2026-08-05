import { Dimensions, FlatList, Modal, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AVAILABLE_MOVEMENT_ICONS } from '../features/movements/iconSuggestion';
import { PressableScale } from './PressableScale';

interface IconPickerModalProps {
  visible: boolean;
  selectedIcon: string;
  onSelect: (icon: string) => void;
  onClose: () => void;
}

const NUM_COLUMNS = 5;
const GRID_PADDING = 16;
const CELL_MARGIN = 4;
// Fixed pixel size instead of flex-1: inside a FlatList numColumns grid,
// flex-1 stretches an incomplete last row's lone item to fill the whole row
// width (there's nothing beside it to share the flex space with) - that's
// what made the last icon render giant.
const CELL_SIZE = (Dimensions.get('window').width - GRID_PADDING * 2) / NUM_COLUMNS - CELL_MARGIN * 2;

/**
 * Bottom sheet (same chrome/height convention as MovementFormModal --
 * rounded top, capped at 90% of the screen) to manually override the
 * auto-suggested movement icon. Used to be a full-screen Modal, which left
 * a large empty gray area below a grid that only needs a few rows.
 */
export function IconPickerModal({ visible, selectedIcon, onSelect, onClose }: IconPickerModalProps) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/40">
        <Pressable
          onPress={onClose}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
        />
        <View className="bg-white rounded-t-2xl" style={{ maxHeight: '90%' }}>
          <View className="flex-row items-center px-4 py-3 border-b border-gray-100">
            <PressableScale onPress={onClose} className="pr-3 py-1" accessibilityRole="button" accessibilityLabel="Volver">
              <Ionicons name="arrow-back" size={24} color="#111827" />
            </PressableScale>
            <Text className="text-lg font-semibold">Elegir ícono</Text>
          </View>

          <FlatList
            data={AVAILABLE_MOVEMENT_ICONS}
            keyExtractor={(icon) => icon}
            numColumns={NUM_COLUMNS}
            contentContainerStyle={{ padding: GRID_PADDING, paddingBottom: 24 }}
            renderItem={({ item: icon }) => {
              const isSelected = icon === selectedIcon;
              return (
                <PressableScale
                  onPress={() => {
                    onSelect(icon);
                    onClose();
                  }}
                  style={{ width: CELL_SIZE, height: CELL_SIZE, margin: CELL_MARGIN }}
                  className={`items-center justify-center rounded-lg border ${
                    isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-200'
                  }`}
                  accessibilityRole="button"
                  accessibilityLabel={icon}
                >
                  <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={26} color={isSelected ? '#fff' : '#374151'} />
                </PressableScale>
              );
            }}
          />
        </View>
      </View>
    </Modal>
  );
}
