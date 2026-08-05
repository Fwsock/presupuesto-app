import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, SectionList, RefreshControl } from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
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
import { useSelectedMonth } from '../../features/shared/selected-month';
import { withMinDuration } from '../../features/shared/withMinDuration';
import { useMovementModal } from '../../features/shared/movement-modal-context';
import { FadeTabScreen } from '../../components/FadeTabScreen';
import { MONTH_NAMES } from '../../features/shared/monthNames';
import { sortMovements, filterMovementsByQuery, type MovementSortField, type SortDirection } from '../../features/movements/sort';
import type { Movement } from '../../features/movements/types';

export default function MovimientosScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const listRef = useRef<SectionList<Movement>>(null);
  const { year, month, setMonth } = useSelectedMonth();
  const todayISO = formatISODate(new Date());
  // Set when the user taps a category on Resumen (drill-down to that category).
  const { categoryId } = useLocalSearchParams<{ categoryId?: string }>();

  const { data: movements, isLoading, isError, refetch } = useMovements(year, month);
  const { data: categories, refetch: refetchCategories } = useCategories();
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

  const toggleEstado = (movement: Movement) => {
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
  };

  const handleDelete = (id: string) => {
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
  };

  const selectCategory = (id: string | undefined) =>
    id ? router.replace({ pathname: '/movimientos', params: { categoryId: id } }) : router.replace('/movimientos');

  // Filter/sort only what's rendered -- the underlying query itself stays
  // unfiltered so the screen behaves normally when none of this is active.
  const categoryFiltered = categoryId ? movements?.filter((m) => m.category_id === categoryId) : movements;
  const searched = categoryFiltered ? filterMovementsByQuery(categoryFiltered, searchQuery) : categoryFiltered;
  const visibleMovements = searched ? sortMovements(searched, sortField, sortDirection) : searched;
  const groupedByDate = sortField === 'fecha';
  const sections = !visibleMovements
    ? []
    : groupedByDate
      ? sortDirection === 'asc'
        ? [...groupMovementsByDate(visibleMovements)].reverse()
        : groupMovementsByDate(visibleMovements)
      : [{ fecha: '', totalDelDia: 0, data: visibleMovements }];

  const filterActive = !!categoryId || sortField !== 'fecha' || sortDirection !== 'desc';

  // Re-tapping the already-active "Movimientos" tab reloads this month's
  // data and scrolls back to the top, matching the tab bar's own tabPress
  // event contract (see AnimatedTabBar) rather than doing nothing. Scroll is
  // NOT animated: an animated scroll takes ~300ms to settle, and on iOS the
  // RefreshControl spinner only renders while the scroll offset is at/above
  // 0 -- starting the refresh before the scroll finishes could leave the
  // spinner invisible for that whole window.
  useEffect(() => {
    const unsubscribe = navigation.addListener('tabPress' as never, () => {
      if (!navigation.isFocused()) return;
      listRef.current?.getScrollResponder()?.scrollTo({ y: 0, animated: false });
      handleRefresh();
    });
    return unsubscribe;
  }, [navigation, handleRefresh]);

  return (
    <FadeTabScreen>
    <View className="flex-1 bg-white">
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
        <SectionList
          ref={listRef}
          className="flex-1"
          sections={sections}
          keyExtractor={(item) => item.id}
          stickySectionHeadersEnabled
          renderSectionHeader={
            groupedByDate
              ? ({ section }) => <MovementDateSectionHeader fecha={section.fecha} totalDelDia={section.totalDelDia} todayISO={todayISO} />
              : undefined
          }
          // MonthSelector + the search bar live inside ListHeaderComponent
          // (not as siblings above the SectionList) for two reasons: they stay
          // visible even when this month has zero movements (previously the
          // whole header area was skipped whenever the movements list was
          // empty), and RefreshControl's spinner is positioned relative to
          // the SectionList's OWN top edge -- as siblings pushing that edge
          // further down the screen, the spinner ended up floating in the
          // middle of the screen instead of sitting right under the nav
          // header like it does on Resumen/Categorías.
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
              <Text className="text-gray-400 text-center px-8">
                {movements && movements.length > 0
                  ? 'Ningún movimiento coincide con la búsqueda o el filtro.'
                  : 'No hay movimientos registrados para este mes.'}
              </Text>
            </View>
          }
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          renderItem={({ item }) => (
            <Animated.View entering={FadeIn.duration(350)} exiting={FadeOut.duration(300)} layout={LinearTransition.duration(300)}>
              <MovementListItem
                movement={item}
                category={categories?.find((c) => c.id === item.category_id)}
                onToggleEstado={() => toggleEstado(item)}
                onEdit={() => openEdit(item)}
                onDelete={() => handleDelete(item.id)}
                isUpdating={updateMovement.isPending && updateMovement.variables?.id === item.id}
              />
            </Animated.View>
          )}
        />
      )}

      {categoryId && categories && (
        <CategoryFilterToast
          categoryName={categories.find((c) => c.id === categoryId)?.nombre ?? ''}
          onReset={() => selectCategory(undefined)}
        />
      )}

      {categories && (
        <MovementFilterSheet
          visible={filterSheetOpen}
          onClose={() => setFilterSheetOpen(false)}
          categories={categories}
          selectedCategoryId={categoryId}
          onSelectCategory={selectCategory}
          sortField={sortField}
          onSortFieldChange={setSortField}
          direction={sortDirection}
          onToggleDirection={() => setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))}
        />
      )}

      {confirmDialog}
    </View>
    </FadeTabScreen>
  );
}
