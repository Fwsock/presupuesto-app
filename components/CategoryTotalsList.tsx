import { View, Text, Pressable } from 'react-native';
import type { CategoryTotal } from '../features/movements/summary';

interface CategoryTotalsListProps {
  totals: CategoryTotal[];
  onPressCategory?: (categoryId: string) => void;
}

export function CategoryTotalsList({ totals, onPressCategory }: CategoryTotalsListProps) {
  return (
    <View className="px-4">
      {totals.map((t) => (
        <Pressable
          key={t.categoryId}
          onPress={() => onPressCategory?.(t.categoryId)}
          className="flex-row justify-between py-2 border-b border-gray-100"
        >
          <Text>{t.nombre}</Text>
          <Text className={t.tipo === 'ingreso' ? 'text-green-600' : 'text-gray-800'}>
            ${t.total.toLocaleString('es-CL')}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
