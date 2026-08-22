import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, SectionList } from 'react-native';
import { useNavigation } from 'expo-router';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import { useMovements, useUpdateMovement, useDeleteMovement, useDeleteMovementGroup } from '../../features/movements/hooks';
import { useCategories } from '../../features/categories/hooks';
import { groupMovementsByDate } from '../../features/movements/dateGrouping';
import { formatISODate } from '../../features/movements/date';
import { MonthSelector } from '../../components/MonthSelector';
import { MovementListItem } from '../../components/MovementListItem';
import { MovementDateSectionHeader } from '../../components/MovementDateSectionHeader';
import { ErrorBanner } from '../../components/ErrorBanner';
import { MovementSearchBar } from '../../components/MovementSearchBar';
import { MovementFilterSheet } from '../../components/MovementFilterSheet';
import { CategoryFilterToast } from '../../components/CategoryFilterToast';
import { useConfirmDialog } from '../../components/ConfirmDialog';
import { ScreenSkeleton } from '../../components/Skeleton';
import { PullToRefresh } from '../../components/PullToRefresh';
import { useSelectedMonth } from '../../features/shared/selected-month';
import { withMinDuration } from '../../features/shared/withMinDuration';
import { useMovementModal } from '../../features/shared/movement-modal-context';
import { useMovementFilter } from '../../features/shared/movement-filter-context';
import { MONTH_NAMES } from '../../features/shared/monthNames';
import { sortMovements, filterMovementsByQuery, type MovementSortField, type SortDirection } from '../../features/movements/sort';
import type { Movement } from '../../features/movements/types';
import type { MovementDateGroup } from '../../features/movements/dateGrouping';

// Module scope, not inside the component: recreating this on every render
// would remount the whole list (a brand-new component type each time),
// losing scroll position and every row's own in-flight animation.
// createAnimatedComponent erases SectionList's generics (sections/items end
// up typed `unknown`, and instance methods like getScrollResponder /
// scrollToLocation disappear from the ref type entirely) -- this cast
// restores the exact same typing plain `SectionList<Movement,
// MovementDateGroup>` already had, it doesn't change what's actually
// rendered at runtime.
const AnimatedSectionList = Animated.createAnimatedComponent(SectionList) as unknown as typeof SectionList<
  Movement,
  MovementDateGroup
>;

function MovimientosScreen() {
  const navigation = useNavigation();
  const listRef = useRef<SectionList<Movement, MovementDateGroup>>(null);
  const { year, month, setMonth } = useSelectedMonth();
  const todayISO = formatISODate(new Date());
  // Set when the user taps a category on Resumen (drill-down to that
  // category) -- shared state, not a route param, see
  // features/shared/movement-filter-context.tsx for why.
  const { categoryFilter, setCategoryFilter } = useMovementFilter();

  const { data: movements, isLoading, isError, refetch } = useMovements(year, month);
  const { data: categories, refetch: refetchCategories } = useCategories();
  // O(1) lookup instead of `categories?.find(...)` re-scanning the whole
  // category list for every visible row on every render -- with a month
  // full of movements this `.find()` was the single biggest JS-thread cost
  // in this screen's render pass.
  const categoriesById = useMemo(() => new Map((categories ?? []).map((c) => [c.id, c])), [categories]);
  const updateMovement = useUpdateMovement();
  const deleteMovement = useDeleteMovement();
  const deleteMovementGroup = useDeleteMovementGroup();
  const { openEdit } = useMovementModal();
  const { confirm, element: confirmDialog } = useConfirmDialog();

  const [actionError, setActionError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<MovementSortField>('fecha');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  // Local, explicit refresh state -- NOT React Query's `isFetching`, which
  // fires for any background refetch (mutations, refocus, etc), not just
  // the user's own pull-to-refresh or tap-to-reload.
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      // See withMinDuration -- a warm cache resolves fast enough that the
      // native spinner never got a chance to actually paint before this
      // flipped back to false, so tapping the active tab looked like a no-op.
      await withMinDuration(Promise.all([refetch(), refetchCategories()]), 700);
    } finally {
      setRefreshing(false);
    }
  }, [refetch, refetchCategories]);

  // Stable across renders (not recreated per keystroke in the search bar,
  // per sort toggle, etc.) so it can be passed straight to every row via a
  // single shared reference -- what actually lets MovementListItem's
  // React.memo skip re-rendering rows whose own props didn't change. See
  // the identical categoriesById/renderItem reasoning further below.
  const toggleEstado = useCallback(
    (movement: Movement) => {
      setActionError(null);
      updateMovement.mutate(
        {
          id: movement.id,
          categoryId: movement.category_id,
          tipo: movement.tipo,
          concepto: movement.concepto,
          monto: movement.monto,
          notas: movement.notas,
          fecha: movement.fecha,
          icono: movement.icono,
          estado: movement.estado === 'pagado' ? 'pendiente' : 'pagado',
        },
        {
          onError: (err) => setActionError((err as Error).message),
        }
      );
    },
    [updateMovement.mutate]
  );

  const handleDelete = useCallback((id: string) => {
    setActionError(null);
    const movement = movements?.find((m) => m.id === id);
    if (!movement) return;

    const onDeleteError = (err: unknown) => setActionError((err as Error).message);
    const conceptoTrimmed = movement.concepto.trim();
    const cuotaLabel =
      movement.cuota_numero && movement.cuota_total
        ? ` (cuota ${movement.cuota_numero}/${movement.cuota_total})`
        : '';

    if (movement.recurring_income_id) {
      const monthIndex = Number(movement.fecha.slice(5, 7)) - 1;
      const mesLabel = `${MONTH_NAMES[monthIndex]} ${movement.fecha.slice(0, 4)}`;
      confirm({
        title: 'Advertencia',
        message: `Estás a punto de eliminar tu ingreso mensual. ¿Estás completamente seguro que deseas eliminar el monto de $${movement.monto.toLocaleString('es-CL')} correspondiente a ${mesLabel}?`,
        icon: 'warning-outline',
        iconColor: '#f59e0b',
        actions: [
          { label: 'Cancelar', variant: 'cancel' },
          { label: 'Eliminar', variant: 'destructive', onPress: () => deleteMovement.mutate(id, { onError: onDeleteError }) },
        ],
      });
    } else if (movement.installment_group_id) {
      confirm({
        title: 'Eliminar compra en cuotas',
        message: `"${conceptoTrimmed}"${cuotaLabel}. ¿Qué deseas eliminar?`,
        actions: [
          {
            label: 'Eliminar solo esta cuota',
            variant: 'destructive',
            onPress: () => deleteMovement.mutate(id, { onError: onDeleteError }),
          },
          {
            label: 'Eliminar toda la compra',
            variant: 'destructive',
            onPress: () => deleteMovementGroup.mutate(movement.installment_group_id!, { onError: onDeleteError }),
          },
          { label: 'Cancelar', variant: 'cancel' },
        ],
      });
    } else {
      confirm({
        title: 'Eliminar movimiento',
        message: `¿Estás seguro que deseas eliminar "${conceptoTrimmed}"?`,
        actions: [
          { label: 'Cancelar', variant: 'cancel' },
          { label: 'Eliminar', variant: 'destructive', onPress: () => deleteMovement.mutate(id, { onError: onDeleteError }) },
        ],
      });
    }
  }, [movements, confirm, deleteMovement.mutate, deleteMovementGroup.mutate]);

  const selectCategory = useCallback((id: string | undefined) => setCategoryFilter(id), [setCategoryFilter]);

  // Plain alias, not a route param: two previous fix attempts (a
  // useFocusEffect blur-cleanup, then an explicit router.navigate to the
  // bare path on tabPress) both relied on expo-router/React Navigation
  // clearing or not-merging route params on an already-mounted tab screen,
  // and both were reported to still leak the filter back in on a real
  // device. The filter is now real React state owned by the (app) layout
  // (see features/shared/movement-filter-context.tsx) -- Movimientos' own
  // tabPress listener there calls `setCategoryFilter(undefined)` directly,
  // which doesn't depend on any router/navigation internals to work.
  const activeCategoryId = categoryFilter;

  // Filter/sort only what's rendered -- the underlying query itself stays
  // unfiltered so the screen behaves normally when none of this is active.
  // Memoized as one pipeline so it only recomputes when one of its actual
  // inputs changed, not on every render (a keystroke elsewhere, a mutation
  // settling, etc. used to re-run this whole filter/sort/group chain for
  // nothing).
  const sections = useMemo(() => {
    const categoryFiltered = activeCategoryId
      ? movements?.filter((m) => m.category_id === activeCategoryId)
      : movements;
    const searched = categoryFiltered ? filterMovementsByQuery(categoryFiltered, searchQuery) : categoryFiltered;
    const visibleMovements = searched ? sortMovements(searched, sortField, sortDirection) : searched;
    const groupedByDate = sortField === 'fecha';
    // A SectionList counts +2 per section for its header/footer slots even
    // when visibleMovements is empty and even when renderSectionHeader isn't
    // provided -- an "empty" single flat section would still report a
    // non-zero item count, which suppresses ListEmptyComponent. Guarding on
    // .length here (not just truthiness) keeps the empty state working the
    // same way regardless of which sortField is active.
    if (!visibleMovements || visibleMovements.length === 0) return [];
    if (!groupedByDate) return [{ fecha: '', totalDelDia: 0, data: visibleMovements }];
    return sortDirection === 'asc'
      ? [...groupMovementsByDate(visibleMovements)].reverse()
      : groupMovementsByDate(visibleMovements);
  }, [movements, activeCategoryId, searchQuery, sortField, sortDirection]);

  const groupedByDate = sortField === 'fecha';
  const filterActive = !!activeCategoryId || sortField !== 'fecha' || sortDirection !== 'desc';

  // Re-tapping the already-active "Movimientos" tab reloads this month's
  // data and scrolls back to the top, matching the tab bar's own tabPress
  // event contract (see AnimatedTabBar) rather than doing nothing. Scroll is
  // NOT animated: an animated scroll takes ~300ms to settle, and starting
  // the refresh before it finishes could leave PullToRefresh's indicator
  // revealing itself over content that's still mid-scroll.
  //
  // getScrollResponder() first (same call as before wrapping the list in
  // Animated.createAnimatedComponent) -- optional-chained because it's
  // unconfirmed whether the animated wrapper still forwards it; falls back
  // to scrollToLocation, guarded against an empty sections array (which
  // throws instead of no-op'ing).
  useEffect(() => {
    const unsubscribe = navigation.addListener('tabPress' as never, () => {
      if (!navigation.isFocused()) return;
      const responder = listRef.current?.getScrollResponder?.();
      if (responder?.scrollTo) {
        responder.scrollTo({ y: 0, animated: false });
      } else if (sections.length > 0) {
        listRef.current?.scrollToLocation?.({ sectionIndex: 0, itemIndex: 0, animated: false, viewPosition: 0 });
      }
      handleRefresh();
    });
    return unsubscribe;
  }, [navigation, handleRefresh, sections.length]);

  // useCallback (not an inline arrow in the JSX below) so SectionList gets
  // the SAME renderItem function reference across renders where nothing
  // relevant to it changed -- an inline `renderItem={({item}) => ...}` is a
  // fresh function every render, which combined with the closures/lookups
  // it used to do inline (categories?.find, per-row () => fn(item)) was the
  // actual JS-thread bottleneck behind the frame drops on this screen.
  const renderMovementItem = useCallback(
    ({ item }: { item: Movement }) => (
      // No `exiting` here: applying/clearing a category filter (or any
      // other change to `sections`) replaces most or all visible rows in
      // one commit -- with `exiting` on top of that, the OLD rows (fading
      // out) stayed rendered, absolutely positioned, right on top of the
      // NEW rows (fading in) at the same scroll position. Caught on camera:
      // that overlap is exactly what read as the list "flashing"/showing a
      // stale, doubled-up set of rows for a beat after tapping a category.
      // `entering` alone still animates genuinely NEW rows in smoothly
      // (e.g. right after saving a movement), and `layout` still animates
      // the reflow when a row is removed.
      <Animated.View entering={FadeIn.duration(350)} layout={LinearTransition.duration(300)}>
        <MovementListItem
          movement={item}
          category={categoriesById.get(item.category_id)}
          onToggleEstado={toggleEstado}
          onEdit={openEdit}
          onDelete={handleDelete}
          isUpdating={updateMovement.isPending && updateMovement.variables?.id === item.id}
        />
      </Animated.View>
    ),
    [categoriesById, toggleEstado, openEdit, handleDelete, updateMovement.isPending, updateMovement.variables]
  );

  return (
    <View className="flex-1 bg-background">
      {isError && <ErrorBanner message="No se pudieron cargar los movimientos." onRetry={refetch} />}
      {actionError && (
        <ErrorBanner message={actionError} onRetry={() => setActionError(null)} actionLabel="Descartar" />
      )}

      {isLoading ? (
        <>
          <MonthSelector year={year} month={month} onChange={setMonth} />
          <ScreenSkeleton />
        </>
      ) : (
        <PullToRefresh refreshing={refreshing} onRefresh={handleRefresh}>
          {(pullProps) => (
            <AnimatedSectionList
              ref={listRef}
              // bg-background (not just flex-1) matters specifically for
              // PullToRefresh: without an opaque background here, this
              // list's own content -- MonthSelector included, which has no
              // background of its own -- is fully transparent, so the pull
              // indicator sitting behind it (same z-stack position as on
              // Resumen) visibly bled through underneath "Agosto 2026"
              // while dragging/snapping back. Resumen's ScrollView already
              // carries this same class for the same reason.
              className="flex-1 bg-background"
              sections={sections}
              keyExtractor={(item) => item.id}
              stickySectionHeadersEnabled
              renderSectionHeader={
                groupedByDate
                  ? ({ section }) => (
                      <MovementDateSectionHeader fecha={section.fecha} totalDelDia={section.totalDelDia} todayISO={todayISO} />
                    )
                  : undefined
              }
              // MonthSelector + the search bar live inside ListHeaderComponent
              // (not as siblings above the list) so they stay visible even
              // when this month has zero movements (previously the whole
              // header area was skipped whenever the movements list was
              // empty) and translate down together with the list as one
              // unit while pulling to refresh.
              ListHeaderComponent={
                <>
                  <MonthSelector year={year} month={month} onChange={setMonth} />
                  {categories && (
                    <MovementSearchBar
                      query={searchQuery}
                      onQueryChange={setSearchQuery}
                      onPressFilter={() => setFilterSheetOpen(true)}
                      filterActive={filterActive}
                    />
                  )}
                </>
              }
              ListEmptyComponent={
                <View className="items-center justify-center py-16">
                  <Text className="font-jakarta text-gray-400 text-center px-8">
                    {movements && movements.length > 0
                      ? 'Ningún movimiento coincide con la búsqueda o el filtro.'
                      : 'No hay movimientos registrados para este mes.'}
                  </Text>
                </View>
              }
              {...pullProps}
              renderItem={renderMovementItem}
              // Virtualization tuning: this month's whole list rarely
              // exceeds a couple hundred rows, but the per-row cost (brand
              // matching, Swipeable, PressableScale) is high enough that
              // rendering everything eagerly was a real first-paint/scroll
              // cost. removeClippedSubviews detaches offscreen rows'
              // native views entirely (not just visually hides them);
              // initialNumToRender/maxToRenderPerBatch/windowSize keep
              // both the first paint and each subsequent scroll batch small.
              removeClippedSubviews
              initialNumToRender={10}
              maxToRenderPerBatch={5}
              updateCellsBatchingPeriod={50}
              windowSize={7}
            />
          )}
        </PullToRefresh>
      )}

      {activeCategoryId && categories && (
        <CategoryFilterToast
          categoryName={categories.find((c) => c.id === activeCategoryId)?.nombre ?? ''}
          onReset={() => selectCategory(undefined)}
        />
      )}

      {categories && (
        <MovementFilterSheet
          visible={filterSheetOpen}
          onClose={() => setFilterSheetOpen(false)}
          categories={categories}
          selectedCategoryId={activeCategoryId}
          onSelectCategory={selectCategory}
          sortField={sortField}
          onSortFieldChange={setSortField}
          direction={sortDirection}
          onToggleDirection={() => setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))}
        />
      )}

      {confirmDialog}
    </View>
  );
}

export default memo(MovimientosScreen);
