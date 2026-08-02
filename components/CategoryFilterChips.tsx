import { ScrollView, Text } from 'react-native';
import { PressableScale } from './PressableScale';
import type { Category } from '../features/categories/types';

interface CategoryFilterChipsProps {
  categories: Category[];
  selectedCategoryId: string | undefined;
  onSelect: (categoryId: string | undefined) => void;
}

/** Horizontal scrollable "Todas" + one chip per category, replacing the old text banner. */
export function CategoryFilterChips({ categories, selectedCategoryId, onSelect }: CategoryFilterChipsProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="px-4 py-2"
    >
      <PressableScale
        onPress={() => onSelect(undefined)}
        className={`px-3 py-2 mr-2 rounded-full border ${
          !selectedCategoryId ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
        }`}
      >
        <Text className={!selectedCategoryId ? 'text-white' : 'text-black'}>Todas</Text>
      </PressableScale>

      {categories.map((c) => {
        const selected = c.id === selectedCategoryId;
        return (
          <PressableScale
            key={c.id}
            onPress={() => onSelect(c.id)}
            className={`px-3 py-2 mr-2 rounded-full border ${selected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}
          >
            <Text className={selected ? 'text-white' : 'text-black'}>{c.nombre}</Text>
          </PressableScale>
        );
      })}
    </ScrollView>
  );
}
