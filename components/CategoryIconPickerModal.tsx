import { Dimensions, FlatList, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CATEGORY_ICONS } from '../features/categories/visualOptions';
import { PressableScale } from './PressableScale';
import { AnimatedBottomSheet } from './AnimatedBottomSheet';

interface CategoryIconPickerModalProps {
  visible: boolean;
  selectedIcon: string;
  /** Tints the selected cell so the grid previews the icon+color pair together, not the icon in isolation. */
  color: string;
  onSelect: (icon: string) => void;
  onClose: () => void;
}

const NUM_COLUMNS = 5;
const GRID_PADDING = 16;
const CELL_MARGIN = 4;
// Same reasoning as IconPickerModal: a fixed pixel size avoids flex-1
// stretching an incomplete last row's lone cell to fill the whole row.
const CELL_SIZE = (Dimensions.get('window').width - GRID_PADDING * 2) / NUM_COLUMNS - CELL_MARGIN * 2;

/** Icon grid for a category's avatar -- same bottom-sheet chrome as the movement IconPickerModal, over CATEGORY_ICONS instead of AVAILABLE_MOVEMENT_ICONS. */
export function CategoryIconPickerModal({ visible, selectedIcon, color, onSelect, onClose }: CategoryIconPickerModalProps) {
  return (
    <AnimatedBottomSheet visible={visible} onClose={onClose} maxHeightPercent={90}>
      <View className="flex-row items-center px-4 py-3 border-b border-border">
        <PressableScale onPress={onClose} className="pr-3 py-1" accessibilityRole="button" accessibilityLabel="Volver">
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </PressableScale>
        <Text className="text-lg font-jakarta-semibold">Elegir ícono</Text>
      </View>

      <FlatList
        data={CATEGORY_ICONS}
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
              style={[
                { width: CELL_SIZE, height: CELL_SIZE, margin: CELL_MARGIN },
                isSelected ? { backgroundColor: color } : undefined,
              ]}
              className={`items-center justify-center rounded-lg border ${isSelected ? '' : 'border-gray-200'}`}
              accessibilityRole="button"
              accessibilityLabel={icon}
            >
              <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={26} color={isSelected ? '#fff' : '#374151'} />
            </PressableScale>
          );
        }}
        removeClippedSubviews
        initialNumToRender={30}
        maxToRenderPerBatch={20}
        windowSize={9}
      />
    </AnimatedBottomSheet>
  );
}
