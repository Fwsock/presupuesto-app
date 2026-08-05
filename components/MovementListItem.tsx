import { useState } from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AnimatedSwitch } from './AnimatedSwitch';
import { PressableScale } from './PressableScale';
import { MovementDetailSheet } from './MovementDetailSheet';
import { isRecurringGeneratedMovement } from '../features/movements/recurringLock';
import { formatLongDate } from '../features/movements/date';
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

// Fixed widths for the amount + switch slots, so the switch's right edge
// always sits flush against the row's own padding. Editar/Eliminar moved
// into MovementDetailSheet (opened by tapping the row) -- the row itself
// only needs to reserve space for the amount and the Pagado/Pendiente
// switch, which is what gives the concepto text its extra width.
const AMOUNT_WIDTH = 88;
const SWITCH_SLOT_WIDTH = 46;
const TRAILING_GAP = 6;

export function MovementListItem({
  movement,
  category,
  onToggleEstado,
  onEdit,
  onDelete,
  isUpdating = false,
}: MovementListItemProps) {
  const [detailVisible, setDetailVisible] = useState(false);
  const isPagado = movement.estado === 'pagado';
  // While the save is in flight, show the target state so the switch doesn't
  // snap back to the old value; it settles to the server state when done.
  const displayPagado = isUpdating ? !isPagado : isPagado;
  const isLocked = isRecurringGeneratedMovement(movement);
  const isGasto = movement.tipo === 'gasto';
  const openDetail = () => setDetailVisible(true);

  return (
    <View className="flex-row items-center px-4 py-3 border-b border-gray-100">
      {/* This plain View -- not PressableScale itself -- is what carries
          flex-1: PressableScale's className lands on its INNER Pressable,
          one level below the Animated.View that's the actual flex child of
          this row, so a bare "flex-1" className on PressableScale never
          reaches the parent flex layout and the whole left side collapses
          to its content width instead of sharing space with the right side. */}
      <View className="flex-1">
        <PressableScale
          onPress={openDetail}
          className="flex-row items-center"
          accessibilityRole="button"
          accessibilityLabel={`Ver detalle de ${movement.concepto}`}
        >
          <View className="w-9 h-9 rounded-full bg-gray-100 items-center justify-center mr-3">
            <Ionicons name={movement.icono as keyof typeof Ionicons.glyphMap} size={18} color="#374151" />
          </View>

          <View className="flex-1 pr-2">
            <Text className="font-medium" numberOfLines={1} ellipsizeMode="tail">
              {movement.concepto}
              {movement.cuota_numero && movement.cuota_total ? ` (${movement.cuota_numero}/${movement.cuota_total})` : ''}
            </Text>
            <Text className="text-gray-500 text-xs mt-0.5">{formatLongDate(movement.fecha)}</Text>
          </View>
        </PressableScale>
      </View>

      {/* Right side, strictly [Monto][Switch], flush to the row's own right
          padding -- no extra flex-1/justify-end needed since this group's
          width is just the sum of its fixed slots. */}
      <View className="flex-row items-center" style={{ gap: TRAILING_GAP }}>
        <PressableScale
          onPress={openDetail}
          style={{ width: AMOUNT_WIDTH }}
          accessibilityRole="button"
          accessibilityLabel={`Ver detalle de ${movement.concepto}`}
        >
          <Text
            className={`font-semibold ${isGasto ? 'text-red-600' : 'text-green-600'}`}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
            style={{ textAlign: 'right' }}
          >
            {isGasto ? '-' : ''}${movement.monto.toLocaleString('es-CL')}
          </Text>
        </PressableScale>

        <View style={{ width: SWITCH_SLOT_WIDTH, alignItems: 'center' }}>
          {!isLocked && (
            <AnimatedSwitch value={displayPagado} onValueChange={onToggleEstado} disabled={isUpdating} />
          )}
        </View>
      </View>

      <MovementDetailSheet
        visible={detailVisible}
        movement={movement}
        category={category}
        onClose={() => setDetailVisible(false)}
        onEdit={() => {
          setDetailVisible(false);
          onEdit();
        }}
        onDelete={() => {
          setDetailVisible(false);
          onDelete();
        }}
        isLocked={isLocked}
      />
    </View>
  );
}
