import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PressableScale } from './PressableScale';
import type { CategoryTotal } from '../features/movements/summary';

interface CategoryTotalsListProps {
  totals: CategoryTotal[];
  onPressCategory?: (categoryId: string) => void;
}

export function CategoryTotalsList({ totals, onPressCategory }: CategoryTotalsListProps) {
  return (
    <View className="px-4">
      {totals.map((t) => (
        <PressableScale
          key={t.categoryId}
          onPress={() => onPressCategory?.(t.categoryId)}
          className="flex-row items-center justify-between py-2 border-b border-gray-100"
        >
          <Text className="flex-1">{t.nombre}</Text>
          <Text
            className={
              t.total === 0 ? 'text-gray-800' : t.tipo === 'ingreso' ? 'text-green-600' : 'text-red-600'
            }
          >
            {t.total > 0 && t.tipo === 'gasto' ? '-' : ''}${t.total.toLocaleString('es-CL')}
          </Text>
          <Ionicons name="chevron-forward" size={18} color="#9ca3af" style={{ marginLeft: 6 }} />
        </PressableScale>
      ))}
    </View>
  );
}
