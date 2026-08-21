import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FullScreenFormModal } from './FullScreenFormModal';
import { MovementIconBadge } from './MovementIconBadge';
import { PressableScale } from './PressableScale';
import { formatFullDate } from '../features/movements/date';
import { theme } from '../lib/theme';
import type { Movement } from '../features/movements/types';
import type { Category } from '../features/categories/types';

interface MovementDetailSheetProps {
  visible: boolean;
  movement: Movement;
  category: Category | undefined;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  /** True for recurring-income-generated movements -- hides both actions, matching the row's previous lock behavior. */
  isLocked: boolean;
}

/**
 * Detail view for a single movement -- opened by tapping anywhere on its
 * MovementListItem row (icon, title, date or amount). Editar/Eliminar live
 * here now (moved off the row in the movements-row-cleanup revamp) so the
 * row itself only needs to reserve width for the Pagado/Pendiente switch.
 */
export function MovementDetailSheet({
  visible,
  movement,
  category,
  onClose,
  onEdit,
  onDelete,
  isLocked,
}: MovementDetailSheetProps) {
  const isGasto = movement.tipo === 'gasto';
  const isPagado = movement.estado === 'pagado';
  const title =
    movement.concepto +
    (movement.cuota_numero && movement.cuota_total ? ` (${movement.cuota_numero}/${movement.cuota_total})` : '');
  const notas = movement.notas?.trim();

  return (
    <FullScreenFormModal visible={visible} title="Detalle del movimiento" onClose={onClose}>
      <View className="items-center mb-6">
        <MovementIconBadge label={movement.concepto} iconName={movement.icono} size={64} style={{ marginBottom: 12 }} />
        <Text className="text-lg font-semibold text-center">{title}</Text>
        <Text
          className={`text-3xl font-bold mt-2 ${isGasto ? 'text-danger' : 'text-income'}`}
          style={{ fontVariant: ['tabular-nums'] }}
        >
          {isGasto ? '-' : ''}${movement.monto.toLocaleString('es-CL')}
        </Text>
      </View>

      <View
        className={`self-center flex-row items-center px-3 py-1.5 rounded-full mb-6 ${isPagado ? 'bg-green-50' : 'bg-orange-50'}`}
      >
        <Ionicons
          name={isPagado ? 'checkmark-circle' : 'time-outline'}
          size={16}
          color={isPagado ? theme.income : '#f59e0b'}
          style={{ marginRight: 6 }}
        />
        <Text className={`text-sm font-medium ${isPagado ? 'text-green-700' : 'text-orange-700'}`}>
          {isPagado ? 'Pagado' : 'Pendiente'}
        </Text>
      </View>

      <View className="border-t border-border pt-4" style={{ gap: 16 }}>
        <View className="flex-row justify-between">
          <Text className="text-secondary">Categoría</Text>
          <Text className="font-medium">{category?.nombre ?? 'Sin categoría'}</Text>
        </View>
        <View className="flex-row justify-between">
          <Text className="text-secondary">Fecha</Text>
          <Text className="font-medium">{formatFullDate(movement.fecha)}</Text>
        </View>
      </View>

      {notas ? (
        <View className="border-t border-border mt-4 pt-4">
          <Text className="text-secondary mb-2">Notas</Text>
          <Text className="text-gray-800 leading-5">{notas}</Text>
        </View>
      ) : null}

      {!isLocked && (
        <View className="border-t border-border mt-6 pt-4 flex-row" style={{ gap: 10 }}>
          <View style={{ flex: 1 }}>
            <PressableScale
              onPress={onEdit}
              className="flex-row items-center justify-center py-3 px-3 rounded-2xl border border-gray-200"
              accessibilityRole="button"
              accessibilityLabel="Editar movimiento"
            >
              <Ionicons name="pencil-outline" size={18} color="#374151" style={{ marginRight: 6 }} />
              <Text className="font-semibold text-gray-700">Editar</Text>
            </PressableScale>
          </View>
          <View style={{ flex: 1 }}>
            <PressableScale
              onPress={onDelete}
              className="flex-row items-center justify-center py-3 px-3 rounded-2xl bg-danger"
              accessibilityRole="button"
              accessibilityLabel="Eliminar movimiento"
            >
              <Ionicons name="trash-outline" size={18} color="#ffffff" style={{ marginRight: 6 }} />
              <Text className="font-semibold text-white">Eliminar</Text>
            </PressableScale>
          </View>
        </View>
      )}
    </FullScreenFormModal>
  );
}
