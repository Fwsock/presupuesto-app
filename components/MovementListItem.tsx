import { Switch, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PressableScale } from './PressableScale';
import type { Movement } from '../features/movements/types';
import type { Category } from '../features/categories/types';

interface MovementListItemProps {
  movement: Movement;
  category: Category | undefined;
  onToggleEstado: () => void;
  onEdit: () => void;
  onDelete: () => void;
  /** True while this row's estado is being saved, so the switch disables. */
  isUpdating?: boolean;
}

export function MovementListItem({
  movement,
  category,
  onToggleEstado,
  onEdit,
  onDelete,
  isUpdating = false,
}: MovementListItemProps) {
  const isPagado = movement.estado === 'pagado';
  // While the save is in flight, show the target state so the switch doesn't
  // snap back to the old value; it settles to the server state when done.
  const displayPagado = isUpdating ? !isPagado : isPagado;

  return (
    <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-100">
      <View className="w-9 h-9 rounded-full bg-gray-100 items-center justify-center mr-3">
        <Ionicons name={movement.icono as keyof typeof Ionicons.glyphMap} size={18} color="#374151" />
      </View>

      <View className="flex-1 pr-2">
        <Text className="font-medium">
          {movement.concepto}
          {movement.cuota_numero && movement.cuota_total ? ` (${movement.cuota_numero}/${movement.cuota_total})` : ''}
        </Text>
        <Text className="text-gray-500 text-xs">{category?.nombre ?? 'Sin categoría'}</Text>
      </View>

      <Text className="font-semibold mr-3">${movement.monto.toLocaleString('es-CL')}</Text>

      <View className="mr-3" style={{ opacity: isUpdating ? 0.5 : 1 }}>
        <Switch
          value={displayPagado}
          onValueChange={onToggleEstado}
          disabled={isUpdating}
          trackColor={{ false: '#d1d5db', true: '#16a34a' }}
          thumbColor="#ffffff"
          ios_backgroundColor="#d1d5db"
        />
      </View>

      <PressableScale
        onPress={onEdit}
        hitSlop={10}
        style={{ minWidth: 44, minHeight: 44 }}
        className="items-center justify-center mr-1"
        accessibilityRole="button"
        accessibilityLabel="Editar"
      >
        <Text>✏️</Text>
      </PressableScale>
      <PressableScale
        onPress={onDelete}
        hitSlop={10}
        style={{ minWidth: 44, minHeight: 44 }}
        className="items-center justify-center"
        accessibilityRole="button"
        accessibilityLabel="Eliminar"
      >
        <Text>🗑️</Text>
      </PressableScale>
    </View>
  );
}
