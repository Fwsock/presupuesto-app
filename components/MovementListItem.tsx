import { memo, useRef, useState } from 'react';
import { View, Text, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Swipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import { AnimatedSwitch } from './AnimatedSwitch';
import { PressableScale } from './PressableScale';
import { MovementDetailSheet } from './MovementDetailSheet';
import { MovementIconBadge } from './MovementIconBadge';
import { isRecurringGeneratedMovement } from '../features/movements/recurringLock';
import { runSwipeToDeleteAction } from '../features/movements/swipeDelete';
import { formatLongDate } from '../features/movements/date';
import type { Movement } from '../features/movements/types';
import type { Category } from '../features/categories/types';

interface MovementListItemProps {
  movement: Movement;
  category: Category | undefined;
  // Item-aware (not pre-bound per-row): lets the parent list pass ONE
  // stable function reference for every row instead of a fresh closure per
  // row per render, which is what actually lets React.memo below skip
  // re-rendering rows whose own props didn't change -- see the identical
  // convention already used by PendingNotificationRow.
  onToggleEstado: (movement: Movement) => void;
  onEdit: (movement: Movement) => void;
  onDelete: (id: string) => void;
  /** True while this row's estado is being saved, so the switch disables. */
  isUpdating?: boolean;
}

// Stable reference (not a fresh object literal on every render) -- passed
// as MovementIconBadge's `style` prop, which is itself React.memo'd and
// would otherwise never skip a re-render since a new {marginRight:12}
// object fails the default shallow prop comparison every time.
const ICON_BADGE_STYLE = { marginRight: 12 };

// Fixed widths for the amount + switch slots, so the switch's right edge
// always sits flush against the row's own padding. Editar/Eliminar moved
// into MovementDetailSheet (opened by tapping the row) -- the row itself
// only needs to reserve space for the amount and the Pagado/Pendiente
// switch, which is what gives the concepto text its extra width.
const AMOUNT_WIDTH = 88;
const SWITCH_SLOT_WIDTH = 46;
const TRAILING_GAP = 6;
// The delete-reveal panel is sized to the same distance required to commit
// to it (see deleteRevealWidth below) -- rightWidth === rightThreshold means
// Swipeable can only ever settle at 0 (snap back) or fully open (delete),
// never at some smaller "stays open" reveal in between. Kept short (a third
// of the row) so the gesture feels quick/agile, while still requiring a
// real deliberate drag -- not just an accidental brush of the row.
const DELETE_REVEAL_RATIO = 0.32;

/**
 * Wrapped in React.memo: rendered once per row in a month's whole movement
 * list, so re-rendering every row whenever an unrelated row's own mutation
 * (toggling estado, deleting) causes the list's parent to re-render was
 * pure wasted work -- this only re-renders a row whose own props actually
 * changed.
 */
export const MovementListItem = memo(function MovementListItem({
  movement,
  category,
  onToggleEstado,
  onEdit,
  onDelete,
  isUpdating = false,
}: MovementListItemProps) {
  const [detailVisible, setDetailVisible] = useState(false);
  // Set by the detail sheet's "Editar" button, consumed by onHidden below --
  // see the comment on the MovementDetailSheet usage for why onEdit(movement)
  // can't fire in the same tick as setDetailVisible(false).
  const pendingEditRef = useRef(false);
  const swipeableRef = useRef<SwipeableMethods>(null);
  const { width: screenWidth } = useWindowDimensions();
  const deleteRevealWidth = screenWidth * DELETE_REVEAL_RATIO;
  const isPagado = movement.estado === 'pagado';
  // While the save is in flight, show the target state so the switch doesn't
  // snap back to the old value; it settles to the server state when done.
  const displayPagado = isUpdating ? !isPagado : isPagado;
  const isLocked = isRecurringGeneratedMovement(movement);
  const isGasto = movement.tipo === 'gasto';
  const openDetail = () => setDetailVisible(true);

  // Fires only once the row has fully settled open -- which, since
  // rightThreshold === the panel's own width, only happens when the drag
  // cleared the full 50%-of-screen distance. A lighter partial swipe never
  // reaches this: Swipeable springs it straight back to 0 on its own.
  const handleFullSwipeDelete = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    runSwipeToDeleteAction(() => swipeableRef.current?.close(), () => onDelete(movement.id));
  };

  const renderRightActions = () => (
    <View style={{ width: deleteRevealWidth }} className="h-full bg-danger items-center justify-center">
      <Ionicons name="trash-outline" size={22} color="#fff" />
      <Text className="text-white text-xs font-jakarta-medium mt-1">Eliminar</Text>
    </View>
  );

  return (
    <Swipeable
      ref={swipeableRef}
      enabled={!isLocked}
      renderRightActions={isLocked ? undefined : renderRightActions}
      rightThreshold={deleteRevealWidth}
      overshootRight={false}
      onSwipeableOpen={handleFullSwipeDelete}
    >
    <View className="flex-row items-center px-4 py-3 border-b border-border bg-white">
      {/* This plain View -- not PressableScale itself -- is what carries
          flex-1: PressableScale's className lands on its INNER Pressable,
          one level below the Animated.View that's the actual flex child of
          this row, so a bare "flex-1" className on PressableScale never
          reaches the parent flex layout and the whole left side collapses
          to its content width instead of sharing space with the right side. */}
      <View className="flex-1">
        <PressableScale
          onPress={openDetail}
          scaleTo={0.965}
          activeOpacity={0.7}
          spring
          haptics
          className="flex-row items-center"
          accessibilityRole="button"
          accessibilityLabel={`Ver detalle de ${movement.concepto}`}
        >
          <MovementIconBadge
            label={movement.concepto}
            iconName={movement.icono}
            size={36}
            style={ICON_BADGE_STYLE}
          />

          <View className="flex-1 pr-2">
            <Text className="font-jakarta-medium" numberOfLines={1} ellipsizeMode="tail">
              {movement.concepto}
              {movement.cuota_numero && movement.cuota_total ? ` (${movement.cuota_numero}/${movement.cuota_total})` : ''}
            </Text>
            <Text className="font-jakarta text-secondary text-xs mt-0.5">{formatLongDate(movement.fecha)}</Text>
          </View>
        </PressableScale>
      </View>

      {/* Right side, strictly [Monto][Switch], flush to the row's own right
          padding -- no extra flex-1/justify-end needed since this group's
          width is just the sum of its fixed slots. */}
      <View className="flex-row items-center" style={{ gap: TRAILING_GAP }}>
        <PressableScale
          onPress={openDetail}
          scaleTo={0.965}
          activeOpacity={0.7}
          spring
          haptics
          style={{ width: AMOUNT_WIDTH }}
          accessibilityRole="button"
          accessibilityLabel={`Ver detalle de ${movement.concepto}`}
        >
          <Text
            className={`font-jakarta-semibold ${isGasto ? 'text-danger' : 'text-income'}`}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
            style={{ textAlign: 'right', fontVariant: ['tabular-nums'] }}
          >
            {isGasto ? '-' : ''}${movement.monto.toLocaleString('es-CL')}
          </Text>
        </PressableScale>

        <View style={{ width: SWITCH_SLOT_WIDTH, alignItems: 'center' }}>
          {!isLocked && (
            <AnimatedSwitch value={displayPagado} onValueChange={() => onToggleEstado(movement)} disabled={isUpdating} />
          )}
        </View>
      </View>

      <MovementDetailSheet
        visible={detailVisible}
        movement={movement}
        category={category}
        onClose={() => setDetailVisible(false)}
        // iOS presents each RN <Modal> as a real native UIViewController --
        // presenting the edit modal while this sheet's own dismissal is
        // still mid-animation raced two native transitions and froze the
        // app. Only flag the intent here; the actual onEdit(movement) call
        // (which opens MovementFormModal, a second <Modal>) is deferred to
        // onHidden, once this sheet has truly finished closing.
        onEdit={() => {
          pendingEditRef.current = true;
          setDetailVisible(false);
        }}
        onHidden={() => {
          if (pendingEditRef.current) {
            pendingEditRef.current = false;
            onEdit(movement);
          }
        }}
        onDelete={() => {
          setDetailVisible(false);
          onDelete(movement.id);
        }}
        isLocked={isLocked}
      />
    </View>
    </Swipeable>
  );
});
