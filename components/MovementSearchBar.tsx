import { View, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PressableScale } from './PressableScale';
import { INPUT_PLACEHOLDER_COLOR, INPUT_SELECTION_COLOR, INPUT_CURSOR_COLOR, INPUT_TEXT_COLOR } from './inputTheme';
import { theme, cardShadow } from '../lib/theme';

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
        className="flex-1 flex-row items-center bg-surface border border-gray-200 rounded-xl px-3"
        style={{ height: 44, ...cardShadow }}
      >
        <Ionicons name="search" size={18} color="#6b7280" style={{ marginRight: 6 }} />
        <TextInput
          className="flex-1 font-jakarta"
          style={{ color: INPUT_TEXT_COLOR }}
          placeholder="Buscar por nombre o descripción"
          placeholderTextColor={INPUT_PLACEHOLDER_COLOR}
          selectionColor={INPUT_SELECTION_COLOR}
          cursorColor={INPUT_CURSOR_COLOR}
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
        style={{ width: 44, height: 44, ...cardShadow }}
        className="items-center justify-center rounded-xl bg-surface border border-gray-200"
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
              backgroundColor: theme.brand,
            }}
          />
        )}
      </PressableScale>
    </View>
  );
}
