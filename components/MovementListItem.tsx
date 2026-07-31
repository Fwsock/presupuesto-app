import { View, Text, Pressable } from 'react-native';
import type { Movement } from '../features/movements/types';
import type { Category } from '../features/categories/types';

interface MovementListItemProps {
  movement: Movement;
  category: Category | undefined;
  onToggleEstado: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function MovementListItem({ movement, category, onToggleEstado, onEdit, onDelete }: MovementListItemProps) {
  return (
    <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-100">
      <View className="flex-1">
        <Text className="font-medium">
          {movement.concepto}
          {movement.cuota_numero && movement.cuota_total ? ` (${movement.cuota_numero}/${movement.cuota_total})` : ''}
        </Text>
        <Text className="text-gray-500 text-xs">{category?.nombre ?? 'Sin categoría'}</Text>
      </View>

      <Text className="font-semibold mr-3">${movement.monto.toLocaleString('es-CL')}</Text>

      <Pressable onPress={onToggleEstado} className="mr-3">
        <Text className={movement.estado === 'pagado' ? 'text-green-600' : 'text-yellow-600'}>
          {movement.estado === 'pagado' ? 'Pagado' : 'Pendiente'}
        </Text>
      </Pressable>

      <Pressable onPress={onEdit} className="mr-3">
        <Text>✏️</Text>
      </Pressable>
      <Pressable onPress={onDelete}>
        <Text>🗑️</Text>
      </Pressable>
    </View>
  );
}
