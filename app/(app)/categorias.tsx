import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { LayoutAnimation, Pressable, View, Text, FlatList, Platform, useWindowDimensions } from 'react-native';
import { useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import Swipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import * as Haptics from 'expo-haptics';
import { useCategories, useDeleteCategory, useReassignCategoryMovements } from '../../features/categories/hooks';
import { getCategoryVisuals } from '../../features/categories/visualMapper';
import { useMovements, usePayAllPendingForCategory } from '../../features/movements/hooks';
import { formatLongDate } from '../../features/movements/date';
import { useSelectedMonth } from '../../features/shared/selected-month';
import { withMinDuration } from '../../features/shared/withMinDuration';
import { MONTH_NAMES } from '../../features/shared/monthNames';
import { CategoryFormModal } from '../../components/CategoryFormModal';
import { CategoryIconBadge } from '../../components/CategoryIconBadge';
import { CategoryDistributionBar, type DistributionSlice } from '../../components/CategoryDistributionBar';
import { CategoryDeleteSheet } from '../../components/CategoryDeleteSheet';
import { ErrorBanner } from '../../components/ErrorBanner';
import { InboxHeaderButton } from '../../components/InboxHeaderButton';
import { PressableScale } from '../../components/PressableScale';
import { useConfirmDialog } from '../../components/ConfirmDialog';
import { PullToRefresh } from '../../components/PullToRefresh';
import { theme, headerTitleFont, cardShadow } from '../../lib/theme';
import { ScreenSkeleton } from '../../components/Skeleton';
import { useMovementModal } from '../../features/shared/movement-modal-context';
import type { Category } from '../../features/categories/types';
import type { Movement } from '../../features/movements/types';

// Module scope, not inside the component -- see the identical note in
// movimientos.tsx (recreating this per-render would remount the whole
// list). Cast restores the exact generic FlatList<Category> already had;
// createAnimatedComponent erases it to `unknown`/drops instance methods.
const AnimatedFlatList = Animated.createAnimatedComponent(FlatList) as unknown as typeof FlatList<Category>;

type TypeFilter = 'todas' | 'fijas' | 'variables';

interface CategoryPendingInfo {
  count: number;
  total: number;
  items: Movement[];
}

const EMPTY_PENDING: CategoryPendingInfo = { count: 0, total: 0, items: [] };

// Two fixed-width swipe buttons (Editar/Eliminar) as a fraction of screen
// width -- same "swipe reveals a panel, a real tap on a button fires it"
// contract as MovementListItem's single delete action, except this panel
// never auto-fires on full swipe (two destinations would make an auto-fire
// ambiguous), it just reveals and waits for an explicit tap.
const SWIPE_ACTION_WIDTH_RATIO = 0.21;

interface CategoryRowProps {
  category: Category;
  pending: CategoryPendingInfo;
  paidTotal: number;
  isPaying: boolean;
  isExpanded: boolean;
  onToggleExpand: (id: string) => void;
  onEdit: (category: Category) => void;
  onDelete: (category: Category) => void;
  onPayAll: (category: Category) => void;
}

// Extracted + React.memo'd so a change to ONE category (paying it off,
// editing it, expanding it) only re-renders that row instead of the whole
// visible list -- same reasoning as MovementListItem. Every prop here is
// either a primitive, the category object itself (stable per item unless
// actually edited), or an item-aware callback the parent passes as ONE
// stable reference for every row (see the parent's useCallback wraps).
const CategoryRow = memo(function CategoryRow({
  category,
  pending,
  paidTotal,
  isPaying,
  isExpanded,
  onToggleExpand,
  onEdit,
  onDelete,
  onPayAll,
}: CategoryRowProps) {
  const { count, total, items } = pending;
  const swipeableRef = useRef<SwipeableMethods>(null);
  const { width: screenWidth } = useWindowDimensions();
  const actionWidth = screenWidth * SWIPE_ACTION_WIDTH_RATIO;
  const visuals = getCategoryVisuals(category);

  // Closes the row first, then waits for its slide-back animation to
  // actually settle before firing the action -- opening the edit sheet (or
  // the reassign/confirm dialog), or toggling the accordion, in the SAME
  // tick as .close() would present/resize it while the row behind was still
  // mid-slide, letting the blue/red panel peek out from under it for a
  // frame. 180ms comfortably covers ReanimatedSwipeable's own reset spring.
  // Applied uniformly to every trigger inside this card (edit, delete,
  // expand, pay-all) -- not just edit/delete -- since ANY of them can be
  // reached while the row happens to still be swiped open.
  const closeAnd = (action: () => void) => {
    swipeableRef.current?.close();
    setTimeout(action, 180);
  };

  // DEFINITIVE ROOT CAUSE (found by measuring the actual box model, not
  // guessing at rendering artifacts): react-native-gesture-handler's own
  // ReanimatedSwipeable source mounts renderRightActions inside a
  // library-owned wrapper styled `{...StyleSheet.absoluteFillObject,
  // overflow:'hidden'}` -- i.e. top:0/left:0/right:0/bottom:0 pinned to the
  // Swipeable's OUTER row (which is exactly as tall as our white card PLUS
  // its own my-1.5 margins, since that card is the only flow content
  // determining the row's auto height). That absolutely-filled box has a
  // FIXED, definite height with a perfectly square (non-rounded) clip.
  //
  // Our own wrapper here used to set BOTH `height: '100%'` AND
  // `marginVertical: 6`. Percentage height resolves against the parent's
  // full box regardless of the child's own margin (unlike flex `stretch`,
  // which subtracts the child's margin automatically) -- so the wrapper's
  // rendered box was `marginTop(6) + height(100%) + marginBottom(6)`,
  // i.e. 12px TALLER than the square clip box it sits inside. The bottom
  // 6px of that box -- exactly where the borderBottomRightRadius curve
  // lives -- fell past the clip boundary and got sliced off flat by the
  // ancestor's straight, unrounded overflow:hidden edge. This reproduced
  // deterministically on both platforms; it was never actually about
  // PressableScale's transform/GPU layer (a real but secondary effect at
  // best) -- it was plain box-model arithmetic.
  //
  // FIX: drop the explicit height entirely. The parent's default
  // `alignItems: 'stretch'` (its own flexDirection is row-reverse, so the
  // cross axis is vertical) sizes an auto-height child to exactly
  // `container height − child's own vertical margin` -- which is precisely
  // "the row's full height, inset by our 6px top/bottom margin" with zero
  // overflow past the clip. The two Pressables inside keep `height: '100%'`
  // safely: percentage height there resolves against THIS wrapper's own
  // (now correctly stretch-computed) height, which carries no extra margin
  // of its own to conflict with.
  const renderRightActions = () => (
    <View
      className="flex-row overflow-hidden"
      style={{ marginVertical: 6, marginRight: 16, borderRadius: 16 }}
    >
      <Pressable
        onPress={() => closeAnd(() => onEdit(category))}
        style={{
          width: actionWidth,
          height: '100%',
          borderTopLeftRadius: 16,
          borderBottomLeftRadius: 16,
          backgroundColor: theme.brand,
          alignItems: 'center',
          justifyContent: 'center',
        }}
        accessibilityRole="button"
        accessibilityLabel={`Editar ${category.nombre}`}
      >
        <Ionicons name="pencil-outline" size={20} color="#fff" />
        <Text className="text-white text-xs font-jakarta-medium mt-1">Editar</Text>
      </Pressable>
      <Pressable
        onPress={() => closeAnd(() => onDelete(category))}
        style={{
          width: actionWidth,
          height: '100%',
          borderTopRightRadius: 16,
          borderBottomRightRadius: 16,
          backgroundColor: theme.danger,
          alignItems: 'center',
          justifyContent: 'center',
        }}
        accessibilityRole="button"
        accessibilityLabel={`Eliminar ${category.nombre}`}
      >
        <Ionicons name="trash-outline" size={20} color="#fff" />
        <Text className="text-white text-xs font-jakarta-medium mt-1">Eliminar</Text>
      </Pressable>
    </View>
  );

  return (
    <Animated.View entering={FadeIn.duration(350)} exiting={FadeOut.duration(300)} layout={LinearTransition.duration(300)}>
      <Swipeable
        ref={swipeableRef}
        renderRightActions={renderRightActions}
        rightThreshold={actionWidth * 2}
        overshootRight={false}
        onSwipeableWillOpen={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
      >
        <PressableScale
          // Deliberately NOT closeAnd's close-then-wait-180ms pattern: that
          // delay exists to protect a MODAL from presenting mid-slide (see
          // closeAnd's own comment), which doesn't apply here -- expanding
          // the accordion is just a local re-render, so closing the swipe
          // and flipping isExpanded fire in the same tick and animate in
          // parallel (Swipeable's own reset spring alongside the
          // accordion's FadeIn/FadeOut+LinearTransition), with no
          // in-between state where a stale blue/red panel could flash.
          onPress={() => {
            swipeableRef.current?.close();
            onToggleExpand(category.id);
          }}
          scaleTo={0.985}
          activeOpacity={0.85}
          spring
          className="mx-4 my-1.5 bg-surface rounded-2xl border border-border px-4 py-4"
          style={cardShadow}
          accessibilityRole="button"
          accessibilityLabel={`Ver desglose de ${category.nombre}`}
        >
          <View className="flex-row items-center">
            <CategoryIconBadge icono={visuals.icono} color={visuals.color} size={40} style={{ marginRight: 10 }} />
            <View className="flex-row items-center flex-1 pr-2" style={{ gap: 6 }}>
              <Text className="font-jakarta-medium text-ink" numberOfLines={1}>{category.nombre}</Text>
              {category.es_fija && (
                <View className="px-2 py-0.5 rounded-full bg-blue-50">
                  <Text className="text-brand text-xs font-jakarta-medium">Fija</Text>
                </View>
              )}
            </View>
            <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={18} color="#CBD5E1" />
          </View>

          <View className="flex-row items-center justify-between mt-3">
            <View style={{ gap: 2 }}>
              <Text className="font-jakarta text-secondary text-xs">
                Pagado: <Text className="font-jakarta-medium text-income">${paidTotal.toLocaleString('es-CL')}</Text>
              </Text>
              <Text className="font-jakarta text-secondary text-xs">
                Pendiente: <Text className="font-jakarta-medium text-ink">${total.toLocaleString('es-CL')}</Text>
              </Text>
            </View>
            {count > 0 ? (
              <PressableScale
                onPress={() => closeAnd(() => onPayAll(category))}
                disabled={isPaying}
                scaleTo={0.965}
                activeOpacity={0.7}
                spring
                haptics
                className={`px-3 py-1.5 rounded-full bg-brand ${isPaying ? 'opacity-60' : ''}`}
                accessibilityRole="button"
                accessibilityLabel="Pagar todo"
              >
                <Text className="text-white text-xs font-jakarta-medium" style={{ fontVariant: ['tabular-nums'] }}>
                  {isPaying ? 'Pagando...' : `Pagar todo ($${total.toLocaleString('es-CL')})`}
                </Text>
              </PressableScale>
            ) : (
              <View className="flex-row items-center px-3 py-1.5 rounded-full bg-gray-100">
                <Ionicons name="checkmark-circle" size={14} color={theme.income} style={{ marginRight: 4 }} />
                <Text className="text-secondary text-xs font-jakarta-medium">Todo pagado</Text>
              </View>
            )}
          </View>

          {isExpanded && (
            <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)} className="mt-3 pt-3 border-t border-border">
              {items.length === 0 ? (
                <Text className="font-jakarta text-secondary text-xs">Sin movimientos pendientes este mes.</Text>
              ) : (
                items.map((m) => (
                  <View key={m.id} className="flex-row items-center justify-between py-1.5">
                    <Text className="font-jakarta text-ink text-sm flex-1 pr-2" numberOfLines={1}>
                      {m.concepto}
                    </Text>
                    <Text className="font-jakarta text-secondary text-xs mr-2">{formatLongDate(m.fecha)}</Text>
                    <Text className="font-jakarta-semibold text-sm" style={{ fontVariant: ['tabular-nums'] }}>
                      ${m.monto.toLocaleString('es-CL')}
                    </Text>
                  </View>
                ))
              )}
            </Animated.View>
          )}
        </PressableScale>
      </Swipeable>
    </Animated.View>
  );
});

interface TypeFilterChipsProps {
  value: TypeFilter;
  onChange: (value: TypeFilter) => void;
}

const TYPE_FILTERS: { value: TypeFilter; label: string }[] = [
  { value: 'todas', label: 'Todas' },
  { value: 'fijas', label: 'Fijas' },
  { value: 'variables', label: 'Variables' },
];

function TypeFilterChips({ value, onChange }: TypeFilterChipsProps) {
  return (
    <View className="flex-row px-4 pt-3 pb-1" style={{ gap: 8 }}>
      {TYPE_FILTERS.map((f) => {
        const selected = f.value === value;
        return (
          <PressableScale
            key={f.value}
            onPress={() => onChange(f.value)}
            scaleTo={0.965}
            activeOpacity={0.7}
            spring
            className={`px-3 py-1.5 rounded-full border ${selected ? 'bg-brand border-brand' : 'border-gray-200'}`}
            accessibilityRole="button"
            accessibilityLabel={f.label}
          >
            <Text className={`font-jakarta text-sm ${selected ? 'text-white' : 'text-black'}`}>{f.label}</Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

function CategoriasScreen() {
  const navigation = useNavigation();
  const { openInbox, pendingCount } = useMovementModal();
  const listRef = useRef<FlatList<Category>>(null);
  const { year, month } = useSelectedMonth();
  const { data: categories, isLoading, isError, refetch } = useCategories();
  const { data: movements, refetch: refetchMovements } = useMovements(year, month);
  const deleteCategory = useDeleteCategory();
  const reassignMovements = useReassignCategoryMovements();
  const payAllPending = usePayAllPendingForCategory();
  const { confirm, element: confirmDialog } = useConfirmDialog();

  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [payingCategoryId, setPayingCategoryId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('todas');
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);
  // Local, explicit refresh state -- NOT React Query's `isFetching`, which
  // fires for any background refetch, not just the user's own
  // pull-to-refresh or tap-to-reload.
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      // See withMinDuration -- a warm cache resolves fast enough that the
      // native spinner never got a chance to actually paint before this
      // flipped back to false, so tapping the active tab looked like a no-op.
      await withMinDuration(Promise.all([refetch(), refetchMovements()]), 700);
    } finally {
      setRefreshing(false);
    }
  }, [refetch, refetchMovements]);

  const openCreate = useCallback(() => {
    setEditing(null);
    setModalVisible(true);
  }, []);

  // Platform-specific on purpose, confirmed on real devices for both: iOS's
  // react-navigation header centers the title based on headerRight's width
  // at the time it first measures the header, which ran before this effect
  // swapped in the real (wide) headerRight -- on iOS's narrower screens the
  // title's centered position was never recalculated afterward, so "Tus
  // categorías" rendered UNDER "+ Nueva categoría" (confirmed on an iPhone
  // 17 Pro simulator screenshot). Android phones are wide enough that the
  // same two-slot layout never showed this -- confirmed on a real HyperOS
  // device both before and after the iOS-only rewrite below -- so Android
  // keeps the simpler, original two-slot approach (declarative `headerTitle`
  // from app/(app)/_layout.tsx untouched, this effect only overrides
  // headerRight) rather than carrying the iOS workaround's extra structure
  // for a screen width where it was never needed.
  useLayoutEffect(() => {
    if (Platform.OS === 'ios') {
      // Renders title + button + bell as ONE real flexbox row inside
      // `headerTitle` (the slot stretched edge-to-edge via
      // headerTitleContainerStyle, with headerLeft/headerRight suppressed)
      // instead of two independently-measured slots -- makes the overlap
      // above structurally impossible regardless of screen width.
      navigation.setOptions({
        headerLeft: () => null,
        headerRight: () => null,
        headerTitleContainerStyle: { left: 0, right: 0 },
        headerTitle: () => (
          <View
            className="flex-row items-center justify-between"
            style={{ width: '100%', paddingHorizontal: 16, gap: 20 }}
          >
            <Text
              className="font-jakarta text-white text-xl flex-shrink"
              style={headerTitleFont}
              numberOfLines={1}
            >
              Tus categorías
            </Text>
            <View className="flex-row items-center flex-shrink-0" style={{ gap: 20 }}>
              <PressableScale
                onPress={openCreate}
                className="px-3 py-1.5 rounded-full border border-white/70"
                accessibilityRole="button"
                accessibilityLabel="Nueva categoría"
              >
                <Text className="text-white font-jakarta-medium text-sm" numberOfLines={1}>
                  + Nueva categoría
                </Text>
              </PressableScale>
              <InboxHeaderButton count={pendingCount} onPress={openInbox} />
            </View>
          </View>
        ),
      });
    } else {
      // Original Android layout: title stays whatever app/(app)/_layout.tsx
      // declared (`headerTitle: () => <HeaderTitleText text="Tus
      // categorías" />`) -- this only replaces headerRight, same as before
      // the iOS-only overlap fix.
      navigation.setOptions({
        headerRight: () => (
          <View className="flex-row items-center">
            <PressableScale
              onPress={openCreate}
              className="mr-4 px-3 py-1.5 rounded-full border border-white/70"
              accessibilityRole="button"
              accessibilityLabel="Nueva categoría"
            >
              <Text className="text-white font-jakarta-medium text-sm">+ Nueva categoría</Text>
            </PressableScale>
            <InboxHeaderButton count={pendingCount} onPress={openInbox} />
          </View>
        ),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation, pendingCount, openInbox]);

  // Re-tapping the already-active "Categorías" tab reloads and scrolls to
  // top, same contract as Movimientos/Resumen — see AnimatedTabBar. Scroll
  // is NOT animated: an animated scroll takes ~300ms to settle, and
  // starting the refresh before it finishes could leave PullToRefresh's
  // indicator revealing itself over content that's still mid-scroll.
  useEffect(() => {
    const unsubscribe = navigation.addListener('tabPress' as never, () => {
      if (!navigation.isFocused()) return;
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
      handleRefresh();
    });
    return unsubscribe;
  }, [navigation, handleRefresh]);

  const openEdit = useCallback((category: Category) => {
    setEditing(category);
    setModalVisible(true);
  }, []);

  // Same convention as MonthSaldoChart's handleSelect/handleToggleViewMode:
  // configureNext right before the state flip that changes `data` on the
  // FlatList below. Each CategoryRow already has its own Reanimated
  // entering/exiting/layout animations, but those only cover a row's OWN
  // mount/unmount/reposition -- they don't smooth the surrounding list
  // collapsing or expanding as a whole once FlatList's cell recycling
  // drops/adds rows for the new filtered `data` array. LayoutAnimation
  // wraps that entire native re-layout (every remaining row sliding to its
  // new position, the list container's height settling) in one smooth
  // ease-in-ease-out transition instead of an instant snap.
  const handleTypeFilterChange = useCallback((value: TypeFilter) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setTypeFilter(value);
  }, []);

  const toggleExpand = useCallback((id: string) => {
    setExpandedId((current) => (current === id ? null : id));
  }, []);

  // Synchronous and instant, same feel as openEdit -- the has-movements
  // check and the confirm-vs-reassign decision now live INSIDE
  // CategoryDeleteSheet itself (with its own brief loading state), so
  // tapping Eliminar no longer waits on a network round-trip before
  // anything even opens.
  const handleDelete = useCallback((category: Category) => {
    setActionError(null);
    setDeletingCategory(category);
  }, []);

  const otherCategoriesForDelete = useMemo(
    () => (categories ?? []).filter((c) => c.id !== deletingCategory?.id),
    [categories, deletingCategory]
  );

  const handleConfirmDelete = useCallback(() => {
    if (!deletingCategory) return;
    deleteCategory.mutate(deletingCategory.id, {
      onSuccess: () => setDeletingCategory(null),
      onError: (err) => {
        setDeletingCategory(null);
        setActionError((err as Error).message);
      },
    });
  }, [deletingCategory, deleteCategory.mutate]);

  const handleConfirmReassign = useCallback(
    (targetCategoryId: string) => {
      if (!deletingCategory) return;
      const fromId = deletingCategory.id;
      reassignMovements.mutate(
        { fromCategoryId: fromId, toCategoryId: targetCategoryId },
        {
          onSuccess: () => {
            deleteCategory.mutate(fromId, {
              onSuccess: () => setDeletingCategory(null),
              onError: (err) => {
                setDeletingCategory(null);
                setActionError((err as Error).message);
              },
            });
          },
          onError: (err) => {
            setDeletingCategory(null);
            setActionError((err as Error).message);
          },
        }
      );
    },
    [deletingCategory, reassignMovements.mutate, deleteCategory.mutate]
  );

  // O(1) per row instead of `.filter()`-ing the whole month's movements for
  // EVERY category on EVERY render -- precomputed once per movements change
  // into a single pass instead.
  const pendingByCategory = useMemo(() => {
    const map = new Map<string, CategoryPendingInfo>();
    for (const m of movements ?? []) {
      if (m.estado !== 'pendiente') continue;
      const entry = map.get(m.category_id) ?? { count: 0, total: 0, items: [] };
      entry.count += 1;
      entry.total += m.monto;
      entry.items.push(m);
      map.set(m.category_id, entry);
    }
    return map;
  }, [movements]);

  const paidTotalByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of movements ?? []) {
      if (m.estado !== 'pagado') continue;
      map.set(m.category_id, (map.get(m.category_id) ?? 0) + m.monto);
    }
    return map;
  }, [movements]);

  // Each category's share of this month's gastos, for the header's
  // CategoryDistributionBar -- gasto movements only (an "Ingresos" category
  // sitting in the same segmented bar as expense categories would read as a
  // gasto slice, which it isn't), regardless of estado (both paid and still
  // pending count toward what was actually committed to spend this month).
  const distributionSlices = useMemo<DistributionSlice[]>(() => {
    const map = new Map<string, number>();
    for (const m of movements ?? []) {
      if (m.tipo !== 'gasto') continue;
      map.set(m.category_id, (map.get(m.category_id) ?? 0) + m.monto);
    }
    return (categories ?? [])
      .map((c) => ({ id: c.id, nombre: c.nombre, color: getCategoryVisuals(c).color, amount: map.get(c.id) ?? 0 }))
      .filter((s) => s.amount > 0)
      .sort((a, b) => b.amount - a.amount);
  }, [movements, categories]);

  const distributionTotal = useMemo(
    () => distributionSlices.reduce((sum, s) => sum + s.amount, 0),
    [distributionSlices]
  );

  const filteredCategories = useMemo(() => {
    if (!categories) return categories;
    if (typeFilter === 'fijas') return categories.filter((c) => c.es_fija);
    if (typeFilter === 'variables') return categories.filter((c) => !c.es_fija);
    return categories;
  }, [categories, typeFilter]);

  const handlePayAll = useCallback(
    (category: Category) => {
      const { count, total } = pendingByCategory.get(category.id) ?? EMPTY_PENDING;
      if (count === 0) return;

      setActionError(null);
      confirm({
        title: 'Pagar todo',
        message: `¿Estás seguro que deseas pagar el monto total de $${total.toLocaleString('es-CL')} de la categoría "${category.nombre}" correspondiente a ${MONTH_NAMES[month - 1]} ${year}?`,
        icon: 'checkmark-circle-outline',
        iconColor: theme.brand,
        actions: [
          { label: 'Cancelar', variant: 'cancel' },
          {
            label: 'Pagar todo',
            variant: 'default',
            onPress: () => {
              setPayingCategoryId(category.id);
              payAllPending.mutate(
                { categoryId: category.id, year, month },
                {
                  onSettled: () => setPayingCategoryId(null),
                  onError: (err) => setActionError((err as Error).message),
                }
              );
            },
          },
        ],
      });
    },
    [pendingByCategory, confirm, payAllPending.mutate, year, month]
  );

  const renderCategoryItem = useCallback(
    ({ item }: { item: Category }) => (
      <CategoryRow
        category={item}
        pending={pendingByCategory.get(item.id) ?? EMPTY_PENDING}
        paidTotal={paidTotalByCategory.get(item.id) ?? 0}
        isPaying={payingCategoryId === item.id && payAllPending.isPending}
        isExpanded={expandedId === item.id}
        onToggleExpand={toggleExpand}
        onEdit={openEdit}
        onDelete={handleDelete}
        onPayAll={handlePayAll}
      />
    ),
    [
      pendingByCategory,
      paidTotalByCategory,
      payingCategoryId,
      payAllPending.isPending,
      expandedId,
      toggleExpand,
      openEdit,
      handleDelete,
      handlePayAll,
    ]
  );

  return (
    <View className="flex-1 bg-background">
      {isError && <ErrorBanner message="No se pudieron cargar las categorías." onRetry={refetch} />}
      {actionError && (
        <ErrorBanner message={actionError} onRetry={() => setActionError(null)} actionLabel="Descartar" />
      )}

      {distributionSlices.length > 0 && (
        <View className="mx-4 mt-4 bg-surface rounded-2xl border border-border px-4 py-3" style={cardShadow}>
          <Text className="font-jakarta text-secondary text-xs mb-2">
            Distribución de gastos · {MONTH_NAMES[month - 1]} {year}
          </Text>
          <CategoryDistributionBar slices={distributionSlices} />
          <View className="flex-row flex-wrap mt-2.5" style={{ gap: 10 }}>
            {distributionSlices.map((s) => (
              <View key={s.id} className="flex-row items-center" style={{ gap: 5 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: s.color }} />
                <Text className="font-jakarta text-secondary text-xs" numberOfLines={1}>
                  {s.nombre} {Math.round((s.amount / distributionTotal) * 100)}%
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      <TypeFilterChips value={typeFilter} onChange={handleTypeFilterChange} />

      {isLoading ? (
        <ScreenSkeleton />
      ) : (
        <PullToRefresh refreshing={refreshing} onRefresh={handleRefresh}>
          {(pullProps) => (
            <AnimatedFlatList
              ref={listRef}
              // Opaque background so this list's own content fully occludes
              // the PullToRefresh indicator behind it while dragging/
              // snapping back -- see the identical fix (and its full
              // explanation) on movimientos.tsx's AnimatedSectionList; this
              // FlatList had no background class at all before.
              className="flex-1 bg-background"
              contentContainerStyle={{ paddingVertical: 8 }}
              data={filteredCategories}
              keyExtractor={(item) => item.id}
              {...pullProps}
              renderItem={renderCategoryItem}
              removeClippedSubviews
              initialNumToRender={10}
              maxToRenderPerBatch={5}
              updateCellsBatchingPeriod={50}
              windowSize={7}
            />
          )}
        </PullToRefresh>
      )}

      <CategoryFormModal
        visible={modalVisible}
        initialValue={editing}
        onClose={() => setModalVisible(false)}
      />

      <CategoryDeleteSheet
        visible={deletingCategory !== null}
        category={deletingCategory}
        otherCategories={otherCategoriesForDelete}
        isSubmitting={reassignMovements.isPending || deleteCategory.isPending}
        onConfirmDelete={handleConfirmDelete}
        onReassignAndDelete={handleConfirmReassign}
        onClose={() => setDeletingCategory(null)}
      />

      {confirmDialog}
    </View>
  );
}

export default memo(CategoriasScreen);
