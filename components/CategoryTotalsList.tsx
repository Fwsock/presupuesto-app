import { View, Text } from 'react-native';
import type { CategoryTotal } from '../features/movements/summary';

interface CategoryTotalsListProps {
  totals: CategoryTotal[];
}

export function CategoryTotalsList({ totals }: CategoryTotalsListProps) {
  return (
    <View className="px-4">
      {totals.map((t) => (
        <View key={t.categoryId} className="flex-row justify-between py-2 border-b border-gray-100">
          <Text>{t.nombre}</Text>
          <Text className={t.tipo === 'ingreso' ? 'text-green-600' : 'text-gray-800'}>
            ${t.total.toLocaleString('es-CL')}
          </Text>
        </View>
      ))}
    </View>
  );
}
