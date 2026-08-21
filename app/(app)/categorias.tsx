import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { View, Text, FlatList } from 'react-native';
import { useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { useCategories, useDeleteCategory } from '../../features/categories/hooks';
import { categoryHasMovements } from '../../features/categories/api';
import { useMovements, usePayAllPendingForCategory } from '../../features/movements/hooks';
import { useSelectedMonth } from '../../features/shared/selected-month';
import { withMinDuration } from '../../features/shared/withMinDuration';
import { MONTH_NAMES } from '../../features/shared/monthNames';
import { CategoryFormModal } from '../../components/CategoryFormModal';
import { ErrorBanner } from '../../components/ErrorBanner';
import { InboxHeaderButton } from '../../components/InboxHeaderButton';
import { PressableScale } from '../../components/PressableScale';
import { useConfirmDialog } from '../../components/ConfirmDialog';
import { PullToRefresh } from '../../components/PullToRefresh';
import { theme } from '../../lib/theme';
import { ScreenSkeleton } from '../../components/Skeleton';
import { useMovementModal } from '../../features/shared/movement-modal-context';
import type { Category } from '../../features/categories/types';

// Module scope, not inside the component -- see the identical note in
// movimientos.tsx (recreating this per-render would remount the whole
// list). Cast restores the exact generic FlatList<Category> already had;
// createAnimatedComponent erases it to `unknown`/drops instance methods.
const AnimatedFlatList = Animated.createAnimatedComponent(FlatList) as unknown as typeof FlatList<Category>;

interface CategoryRowProps {
  category: Category;
  pending: { count: number; total: number };
  isPaying: boolean;
  onEdit: (category: Category) => void;
  onDelete: (id: string) => void;
  onPayAll: (category: Category) => void;
}

// Extracted + React.memo'd so a change to ONE category (paying it off,
// editing it) only re-renders that row instead of the whole visible list --
// same reasoning as MovementListItem. Every prop here is either a
// primitive, the category object itself (stable per item unless it's
// actually edited), or an item-aware callback the parent passes as ONE
// stable reference for every row (see the parent's useCallback wraps).
const CategoryRow = memo(function CategoryRow({ category, pending, isPaying, onEdit, onDelete, onPayAll }: CategoryRowProps) {
  const { count, total } = pending;
  return (
    <Animated.View entering={FadeIn.duration(350)} exiting={FadeOut.duration(300)} layout={LinearTransition.duration(300)}>
      <PressableScale
        onPress={() => onEdit(category)}
        scaleTo={0.965}
        activeOpacity={0.7}
        spring
        haptics
        className="mx-4 my-1.5 bg-surface rounded-2xl border border-border px-4 py-4"
        style={{ shadowColor: '#0F172A', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 0 }}
        accessibilityRole="button"
        accessibilityLabel={`Editar ${category.nombre}`}
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center flex-1 pr-2" style={{ gap: 6 }}>
            <Text className="font-medium text-ink">{category.nombre}</Text>
            {category.es_fija && (
              <View className="px-2 py-0.5 rounded-full bg-blue-50">
                <Text className="text-brand text-xs font-medium">Fija</Text>
              </View>
            )}
          </View>
          <View className="flex-row items-center" style={{ gap: 4 }}>
            <PressableScale
              onPress={() => onEdit(category)}
              hitSlop={12}
              style={{ width: 36, height: 36 }}
              className="items-center justify-center"
              accessibilityRole="button"
              accessibilityLabel="Editar"
            >
              <Ionicons name="pencil-outline" size={20} color="#374151" />
            </PressableScale>
            <PressableScale
              onPress={() => onDelete(category.id)}
              hitSlop={12}
              style={{ width: 36, height: 36 }}
              className="items-center justify-center"
              accessibilityRole="button"
              accessibilityLabel="Eliminar"
            >
              <Ionicons name="trash-outline" size={20} color="#374151" />
            </PressableScale>
          </View>
        </View>

        <View className="flex-row items-center justify-between mt-2">
          <Text className="text-secondary text-xs">
            {count > 0 ? `${count} pendiente${count > 1 ? 's' : ''}` : 'Sin pendientes'}
          </Text>
          {count > 0 ? (
            <PressableScale
              onPress={() => onPayAll(category)}
              disabled={isPaying}
              scaleTo={0.965}
              activeOpacity={0.7}
              spring
              haptics
              className={`px-3 py-1.5 rounded-full bg-brand ${isPaying ? 'opacity-60' : ''}`}
              accessibilityRole="button"
              accessibilityLabel="Pagar todo"
            >
              <Text className="text-white text-xs font-medium" style={{ fontVariant: ['tabular-nums'] }}>
                {isPaying ? 'Pagando...' : `Pagar todo ($${total.toLocaleString('es-CL')})`}
              </Text>
            </PressableScale>
          ) : (
            <View className="flex-row items-center px-3 py-1.5 rounded-full bg-gray-100">
              <Ionicons name="checkmark-circle" size={14} color={theme.income} style={{ marginRight: 4 }} />
              <Text className="text-secondary text-xs font-medium">Todo pagado</Text>
            </View>
          )}
        </View>
      </PressableScale>
    </Animated.View>
  );
});

const EMPTY_PENDING = { count: 0, total: 0 };

function CategoriasScreen() {
  const navigation = useNavigation();
  const { openInbox, pendingCount } = useMovementModal();
  const listRef = useRef<FlatList<Category>>(null);
  const { year, month } = useSelectedMonth();
  const { data: categories, isLoading, isError, refetch } = useCategories();
  const { data: movements, refetch: refetchMovements } = useMovements(year, month);
  const deleteCategory = useDeleteCategory();
  const payAllPending = usePayAllPendingForCategory();
  const { confirm, element: confirmDialog } = useConfirmDialog();

  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [payingCategoryId, setPayingCategoryId] = useState<string | null>(null);
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

  // Categorías owns the header's right-side action (the FAB it replaces was
  // removed — the center tab-bar "+" only creates movements, not categories)
  // -- but this REPLACES app/(app)/_layout.tsx's default headerRight
  // (InboxHeaderButton), so it has to render that one too, or this is the
  // one screen in the app where the notification bell silently disappears.
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View className="flex-row items-center">
          <PressableScale
            onPress={openCreate}
            className="mr-3 px-3 py-1.5 rounded-full border border-white/70"
            accessibilityRole="button"
            accessibilityLabel="Nueva categoría"
          >
            <Text className="text-white font-medium text-sm">+ Nueva categoría</Text>
          </PressableScale>
          <InboxHeaderButton count={pendingCount} onPress={openInbox} />
        </View>
      ),
    });
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

  const handleDelete = useCallback(
    async (id: string) => {
      setActionError(null);
      const onDeleteError = (err: unknown) => setActionError((err as Error).message);

      try {
        // A category with movements is going to fail the delete with a
        // foreign-key violation regardless of what's shown for the currently
        // selected month, so this checks all-time, not just `movements` above
        // (which is scoped to the month in view) — otherwise a category with
        // movements only in other months would wrongly skip straight to the
        // plain confirm dialog instead of the FK-violation banner.
        const hasMovements = await categoryHasMovements(id);
        if (hasMovements) {
          deleteCategory.mutate(id, { onError: onDeleteError });
          return;
        }
      } catch (err) {
        onDeleteError(err);
        return;
      }

      confirm({
        title: '¿Eliminar categoría?',
        message: '¿Estás seguro de que deseas eliminar esta categoría? Esta acción no se puede deshacer.',
        actions: [
          { label: 'Cancelar', variant: 'cancel' },
          { label: 'Eliminar', variant: 'destructive', onPress: () => deleteCategory.mutate(id, { onError: onDeleteError }) },
        ],
      });
    },
    [deleteCategory.mutate, confirm]
  );

  // O(1) per row instead of `.filter()`-ing the whole month's movements for
  // EVERY category on EVERY render -- precomputed once per movements change
  // into a single pass instead.
  const pendingByCategory = useMemo(() => {
    const map = new Map<string, { count: number; total: number }>();
    for (const m of movements ?? []) {
      if (m.estado !== 'pendiente') continue;
      const entry = map.get(m.category_id) ?? { count: 0, total: 0 };
      entry.count += 1;
      entry.total += m.monto;
      map.set(m.category_id, entry);
    }
    return map;
  }, [movements]);

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
        isPaying={payingCategoryId === item.id && payAllPending.isPending}
        onEdit={openEdit}
        onDelete={handleDelete}
        onPayAll={handlePayAll}
      />
    ),
    [pendingByCategory, payingCategoryId, payAllPending.isPending, openEdit, handleDelete, handlePayAll]
  );

  return (
    <View className="flex-1 bg-background">
      {isError && <ErrorBanner message="No se pudieron cargar las categorías." onRetry={refetch} />}
      {actionError && (
        <ErrorBanner message={actionError} onRetry={() => setActionError(null)} actionLabel="Descartar" />
      )}

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
              data={categories}
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

      {confirmDialog}
    </View>
  );
}

export default memo(CategoriasScreen);
