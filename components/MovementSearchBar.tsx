import { View, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PressableScale } from './PressableScale';

interface MovementSearchBarProps {
  query: string;
  onQueryChange: (query: string) => void;
  onPressFilter: () => void;
  /** Shows a small dot on the filter button when a non-default category/sort is active, so the user knows something's filtered without opening the sheet. */
  filterActive: boolean;
}

/** Clean search-only header row + a compact "Filtrar y ordenar" button that opens MovementFilterSheet — replaces the old always-visible category chips + sort pills that crowded the top of Movimientos. */
export function MovementSearchBar({ query, onQueryChange, onPressFilter, filterActive }: MovementSearchBarProps) {
  return (
    <View className="flex-row items-center px-4 pb-2" style={{ gap: 8 }}>
      <View
        className="flex-1 flex-row items-center border border-gray-300 rounded-md px-3"
        style={{ height: 40 }}
      >
        <Ionicons name="search" size={18} color="#6b7280" style={{ marginRight: 6 }} />
        <TextInput
          className="flex-1"
          placeholder="Buscar por nombre o descripción"
          value={query}
          onChangeText={onQueryChange}
        />
        {query.length > 0 && (
          <PressableScale onPress={() => onQueryChange('')} hitSlop={10} accessibilityRole="button" accessibilityLabel="Limpiar búsqueda">
            <Ionicons name="close-circle" size={18} color="#9ca3af" />
          </PressableScale>
        )}
      </View>

      <PressableScale
        onPress={onPressFilter}
        style={{ width: 40, height: 40 }}
        className="items-center justify-center rounded-md border border-gray-300"
        accessibilityRole="button"
        accessibilityLabel="Filtrar y ordenar"
      >
        <Ionicons name="options-outline" size={20} color="#374151" />
        {filterActive && (
          <View
            style={{
              position: 'absolute',
              top: 6,
              right: 6,
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: '#2563eb',
            }}
          />
        )}
      </PressableScale>
    </View>
  );
}
