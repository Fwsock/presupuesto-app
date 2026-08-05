import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FullScreenFormModal } from './FullScreenFormModal';
import { CategoryFilterChips } from './CategoryFilterChips';
import { PressableScale } from './PressableScale';
import type { Category } from '../features/categories/types';
import type { MovementSortField, SortDirection } from '../features/movements/sort';

const SORT_OPTIONS: { field: MovementSortField; label: string }[] = [
  { field: 'fecha', label: 'Fecha' },
  { field: 'monto', label: 'Monto' },
  { field: 'nombre', label: 'Nombre' },
];

interface MovementFilterSheetProps {
  visible: boolean;
  onClose: () => void;
  categories: Category[];
  selectedCategoryId: string | undefined;
  onSelectCategory: (categoryId: string | undefined) => void;
  sortField: MovementSortField;
  onSortFieldChange: (field: MovementSortField) => void;
  direction: SortDirection;
  onToggleDirection: () => void;
}

/** Bottom sheet holding everything that used to crowd the top of Movimientos: category selection and sort controls, opened from MovementSearchBar's "Filtrar y ordenar" button. */
export function MovementFilterSheet({
  visible,
  onClose,
  categories,
  selectedCategoryId,
  onSelectCategory,
  sortField,
  onSortFieldChange,
  direction,
  onToggleDirection,
}: MovementFilterSheetProps) {
  return (
    <FullScreenFormModal visible={visible} title="Filtrar y ordenar" onClose={onClose}>
      <Text className="text-gray-500 text-xs mb-2">Categoría</Text>
      <CategoryFilterChips categories={categories} selectedCategoryId={selectedCategoryId} onSelect={onSelectCategory} />

      <Text className="text-gray-500 text-xs mb-2 mt-5">Ordenar por</Text>
      <View className="flex-row items-center" style={{ gap: 8 }}>
        {SORT_OPTIONS.map(({ field, label }) => {
          const selected = field === sortField;
          return (
            <PressableScale
              key={field}
              onPress={() => onSortFieldChange(field)}
              className={`px-3 py-2 rounded-full border ${selected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}
            >
              <Text className={selected ? 'text-white' : 'text-black'}>{label}</Text>
            </PressableScale>
          );
        })}
        <PressableScale
          onPress={onToggleDirection}
          hitSlop={8}
          style={{ minWidth: 40, minHeight: 40 }}
          className="items-center justify-center rounded-full border border-gray-300"
          accessibilityRole="button"
          accessibilityLabel={direction === 'asc' ? 'Orden ascendente' : 'Orden descendente'}
        >
          <Ionicons name={direction === 'asc' ? 'arrow-up' : 'arrow-down'} size={18} color="#374151" />
        </PressableScale>
      </View>
    </FullScreenFormModal>
  );
}
